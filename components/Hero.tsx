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
      className="max-container px-6 sm:px-6 lg:px-30 3xl:px-0 flex flex-col gap-8 py-8 md:gap-12 md:py-12 lg:gap-20 lg:py-20 xl:flex-row items-start mt-10 sm:mt-0"
    >
      <div className="absolute right-0 top-10 h-screen w-screen bg-[url('/pattern-bg.png')] bg-cover bg-center md:-right-28 xl:-top-30 opacity-20 sm:opacity-100" />

      <div className="relative z-20 flex flex-1 flex-col xl:w-1/2">
        <Image
          src="/camp.svg"
          alt="camp"
          width={64}
          height={64}
          className="absolute left-0 -top-4 sm:-top-7 w-10 sm:w-12 lg:w-14"
        />

        <h1 className="font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:bold-88 leading-tight">
          Smart Tourist Safety
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-gray-30 mb-4 sm:mb-6 max-w-3xl leading-relaxed mt-4 sm:mt-6">
          An intelligent safety network combining <span className="text-green-500 font-semibold">blockchain identity</span>, 
          IoT geo-tracking, and decentralized emergency mesh — protecting tourists during 
          crises and connectivity failures.
        </p>

        <div className="flex flex-col w-full gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Button 
            size="lg" 
            className="bg-green-600 text-white px-4 sm:px-5 py-3 rounded-md shadow-md hover:brightness-95 transition w-full sm:w-auto"
            onClick={() => router.push('/#get-app')}
          >
            Install Tourist App
            <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
          </Button>

          <Button 
            size="lg" 
            variant="outline" 
            className="relative text-green-600 border-2 border-green-500 px-4 sm:px-5 py-3 rounded-xl w-full sm:w-auto bg-green-50 hover:bg-green-100 hover:border-green-600 hover:text-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
            onClick={() => router.push('/admin')}
          >
            <svg className="mr-2 w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Go to Admin Dashboard
          </Button>
        </div>

        {/* Stats */}
        {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mt-8 sm:mt-10">
          <div className="text-center">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 mb-1">500K+</div>
            <div className="text-xs sm:text-sm text-gray-600">Tourists Protected</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 mb-1">24/7</div>
            <div className="text-xs sm:text-sm text-gray-600">AI Monitoring</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 mb-1">150+</div>
            <div className="text-xs sm:text-sm text-gray-600">Cities Covered</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 mb-1">99.9%</div>
            <div className="text-xs sm:text-sm text-gray-600">Response Rate</div>
          </div>
        </div> */}
      </div>

      <div className="relative flex flex-1 items-start justify-center mt-6 sm:mt-8 xl:mt-0">
        <div className="relative z-20 w-full max-w-sm sm:w-72 flex flex-col gap-4 sm:gap-6 rounded-2xl sm:rounded-3xl bg-black/75 px-4 sm:px-6 py-4 sm:py-6 shadow-lg">
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm sm:text-[16px] font-normal text-green-100">Location</p>
              <Image src="/close.svg" alt="close" width={16} height={16} className="sm:w-5 sm:h-5" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-white">Sonarpur</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-sm sm:text-[16px] font-normal text-green-100">Distance</p>
              <p className="text-lg sm:text-[20px] font-bold text-white">173.28 mi</p>
            </div>
            <div className="flex flex-col">
              <p className="text-sm sm:text-[16px] font-normal text-green-100">Elevation</p>
              <p className="text-lg sm:text-[20px] font-bold text-white">2.040 km</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
