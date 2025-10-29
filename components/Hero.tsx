"use client";
import Image from "next/image";
import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { MouseEvent } from "react";


const Hero = () => {
  const router = useRouter();

  const handleSeeLocation = (e: MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById("map");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // fallback: navigate to map page
    router.push("/map");
  };
  return (
    <section
      aria-label="Hero"
      className="max-container px-6 lg:px-20 3xl:px-0 flex flex-col gap-12 py-12 md:gap-20 lg:py-20 xl:flex-row items-start mt-20"
    >
      <div className="absolute right-0 top-10 h-screen w-screen bg-[url('/pattern-bg.png')] bg-cover bg-center md:-right-28 xl:-top-30" />

      <div className="relative z-20 flex flex-1 flex-col xl:w-1/2">
        <Image
          src="/camp.svg"
          alt="camp"
          width={64}
          height={64}
          className="absolute left-0 -top-7 w-12 lg:w-14"
        />

        <h1 className="font-bold text-7xl lg:bold-88 leading-tight">Smart Tourist Safety</h1>

        <p className="text-lg md:text-xl text-gray-30 mb-6 max-w-3xl leading-relaxed mt-6">
          Advanced <span className="text-green-500 font-semibold">AI monitoring</span> with
          geo-fencing and blockchain digital ID — comprehensive tourist safety and
          real-time incident response.
        </p>

        <div className="flex flex-col w-full gap-3 sm:flex-row sm:items-center">
          <Button size="lg" className="bg-green-600 text-white px-5 py-3 rounded-md shadow-md hover:brightness-95 transition">
            Download App
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>

          <Button size="lg" variant="outline" className="text-green-600 border-green-400 px-5 py-3 rounded-md">
            How we work?
          </Button>

          <Button
            size="lg"
            variant="ghost"
            className="text-black bg-white px-5 py-3 rounded-md"
            onClick={handleSeeLocation}
          >
            See your current location
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mt-10">
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-green-600 mb-1">500K+</div>
            <div className="text-sm text-gray-600">Tourists Protected</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-green-600 mb-1">24/7</div>
            <div className="text-sm text-gray-600">AI Monitoring</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-green-600 mb-1">150+</div>
            <div className="text-sm text-gray-600">Cities Covered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-green-600 mb-1">99.9%</div>
            <div className="text-sm text-gray-600">Response Rate</div>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 items-start justify-center mt-8 xl:mt-0">
  <div className="relative z-20 w-72 flex flex-col gap-6 rounded-3xl bg-gradient-to-r from-black/70 to-black/80 px-6 py-6 shadow-lg">
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-normal text-green-100">Location</p>
              <Image src="/close.svg" alt="close" width={20} height={20} />
            </div>
            <p className="bold-20 text-white">Aguas Calientes</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-[16px] font-normal text-green-100">Distance</p>
              <p className="text-[20px] font-bold text-white">173.28 mi</p>
            </div>
            <div className="flex flex-col">
              <p className="text-[16px] font-normal text-green-100">Elevation</p>
              <p className="text-[20px] font-bold text-white">2.040 km</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
