'use client'

import Nav from "@/components/Nav"
import Hero from "@/components/Hero"
import DeepCalmSection from "@/components/DeepCalmSection"
import WorkingStyle from "@/components/WorkingStyle"
import Services from "@/components/Services"
import CaseStudies from "@/components/CaseStudies"
import SubscribeSection from "@/components/SubscribeSection"
import FAQ from "@/components/FAQ"
import Contact from "@/components/Contact"
import Footer from "@/components/Footer"
import AudioPlayer from "@/components/AudioPlayer"

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <DeepCalmSection />
        <WorkingStyle />
        <Services />
        <CaseStudies />
        <SubscribeSection />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <AudioPlayer />
    </>
  )
}
