"""
Fish Speech 1.5 zero-shot voice cloning via stdin/stdout JSON protocol.
Input:  {"text": "...", "ref_audio": "...", "output": "...", "max_new_tokens": 512}
Output: {"ok": true, "audio": "...", "duration": 1.5, "text": "..."}
"""
import sys
import json
import time
from pathlib import Path
import torch
import torchaudio
import soundfile as sf
from fish_speech.models.vqgan.modules.firefly import FireflyArchitecture
from fish_speech.models.vqgan.modules.firefly import ConvNeXtEncoder, HiFiGANGenerator
from fish_speech.utils.spectrogram import LogMelSpectrogram

# ── 预检查：GPU 不可用时直接失败，避免 import 1.27GB LLM 卡死 ──
if not torch.cuda.is_available():
    # 仍然允许 VQGAN 编码等轻量操作，但 LLM 生成会失败
    pass

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_DIR = ROOT / "models" / "fish-speech-1.5"
DEFAULT_REF_AUDIO = ROOT / "voice-samples" / "yin-yue" / "yin-yue_ref_16k.wav"

vqgan_cache = None
llm_cache = None


def load_vqgan(ckpt_path, device="cpu"):
    spec_transform = LogMelSpectrogram(
        sample_rate=44100, n_mels=160, n_fft=2048,
        hop_length=512, win_length=2048,
    )
    backbone = ConvNeXtEncoder(
        input_channels=160, depths=[3, 3, 9, 3],
        dims=[128, 256, 384, 512], drop_path_rate=0.2, kernel_size=7,
    )
    head = HiFiGANGenerator(
        hop_length=512,
        upsample_rates=[8, 8, 2, 2, 2],
        upsample_kernel_sizes=[16, 16, 4, 4, 4],
        resblock_kernel_sizes=[3, 7, 11],
        resblock_dilation_sizes=[[1, 3, 5], [1, 3, 5], [1, 3, 5]],
        num_mels=512, upsample_initial_channel=512,
        pre_conv_kernel_size=13, post_conv_kernel_size=13,
    )
    quantizer = DownsampleFiniteScalarQuantize(
        input_dim=512, n_groups=8, n_codebooks=1,
        levels=[8, 5, 5, 5], downsample_factor=[2, 2],
    )
    model = FireflyArchitecture(
        spec_transform=spec_transform,
        backbone=backbone,
        head=head,
        quantizer=quantizer,
    )
    sd = torch.load(ckpt_path, map_location="cpu", mmap=True, weights_only=True)
    if "state_dict" in sd:
        sd = sd["state_dict"]
    sd = {k.replace("generator.", ""): v for k, v in sd.items() if "generator." in k}
    model.load_state_dict(sd, strict=False, assign=True)
    model.eval()
    model.to(device)
    return model


def clone_voice(text, ref_audio=None, output_path=None, model_dir=None,
                max_new_tokens=512, device=None):
    global vqgan_cache, llm_cache

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    # ── GPU 快速失败：无 CUDA 时 Fish Speech 1.5 1.27GB LLM 无法加载 ──
    if device == "cpu":
        return {
            "ok": False,
            "error": "No GPU available; Fish Speech requires CUDA for voice cloning. "
                     "Fall back to edge-tts or run on a machine with NVIDIA GPU.",
        }
    if ref_audio is None:
        ref_audio = DEFAULT_REF_AUDIO
    if model_dir is None:
        model_dir = DEFAULT_MODEL_DIR
    model_dir = Path(model_dir)
    ref_audio = Path(ref_audio)
    if output_path is None:
        output_path = ROOT / "output" / f"vc_{int(time.time())}.wav"

    # Load VQGAN (cached)
    if vqgan_cache is None:
        vqgan_ckpt = model_dir / "firefly-gan-vq-fsq-8x1024-21hz-generator.pth"
        vqgan_cache = load_vqgan(vqgan_ckpt, device)
    vqgan = vqgan_cache

    # Load text2semantic LLM (cached)
    if llm_cache is None:
        from fish_speech.models.text2semantic.inference import load_model as load_llm
        llm_model, decode_one_token = load_llm(
            str(model_dir),
            device=device,
            precision=torch.float16 if device == "cuda" else torch.float32,
            compile=False,
        )
        with torch.device(device):
            llm_model.setup_caches(
                max_batch_size=1,
                max_seq_len=llm_model.config.max_seq_len,
                dtype=next(llm_model.parameters()).dtype,
            )
        llm_cache = (llm_model, decode_one_token)
    llm_model, decode_one_token = llm_cache

    # Encode reference audio
    audio_np, sr = sf.read(str(ref_audio))
    audio = torch.from_numpy(audio_np).float()
    if audio.dim() > 1:
        audio = audio.mean(0)
    audio = audio.unsqueeze(0)
    if sr != vqgan.spec_transform.sample_rate:
        audio = torchaudio.functional.resample(
            audio, sr, vqgan.spec_transform.sample_rate)
    audios = audio[None].to(device)
    audio_lengths = torch.tensor([audios.shape[2]], device=device, dtype=torch.long)
    prompt_tokens = vqgan.encode(audios, audio_lengths)[0][0]

    # Generate
    from fish_speech.models.text2semantic.inference import generate_long
    gen = generate_long(
        model=llm_model,
        device=device,
        decode_one_token=decode_one_token,
        text=text,
        num_samples=1,
        max_new_tokens=max_new_tokens,
        top_p=0.7,
        repetition_penalty=1.1,
        temperature=0.7,
        compile=False,
        iterative_prompt=True,
        max_length=2048,
        chunk_length=150,
        prompt_text=["<|voice|>"],
        prompt_tokens=[prompt_tokens],
    )

    codes = None
    for result in gen:
        if result.action == "sample":
            codes = result.codes

    if codes is None:
        return {"ok": False, "error": "No codes generated"}

    # Decode
    codes_t = codes.to(device).long()
    feature_lengths = torch.tensor([codes_t.shape[1]], device=device)
    fake_audios, _ = vqgan.decode(
        indices=codes_t[None], feature_lengths=feature_lengths)
    fake_audio = fake_audios[0, 0].float().detach().cpu().numpy()

    sf.write(output_path, fake_audio, vqgan.spec_transform.sample_rate)
    duration = len(fake_audio) / vqgan.spec_transform.sample_rate

    return {
        "ok": True,
        "audio": str(output_path),
        "duration": round(duration, 2),
        "text": text,
        "device": device,
    }


if __name__ == "__main__":
    raw = sys.stdin.buffer.read().decode("utf-8-sig")
    try:
        params = json.loads(raw)
        result = clone_voice(**params)
    except Exception as e:
        result = {"ok": False, "error": str(e)}
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
    sys.stdout.buffer.flush()
