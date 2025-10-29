import Camp from "@/components/Camp";
import Features from "@/components/Features";
import GetApp from "@/components/GetApp";
import Guide from "@/components/Guide";
import Hero from "@/components/Hero";
import { HowItWorks } from "@/components/how-it-works";

export default function Home() {
  return (
    <>
      <Hero />
      
      <Guide />
      <HowItWorks />
      <Features />
      <GetApp />
    </>
  )
}
