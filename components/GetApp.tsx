"use client";
import React from "react";
import Image from "next/image";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

const GetApp = () => {
  const router = useRouter();
  
  return (
    <section id="get-app" className="flex items-center justify-center w-full flex-col pb-[50px] sm:pb-[100px] mx-auto">
      <div className="relative flex w-full flex-col justify-between gap-16 sm:gap-32 overflow-hidden bg-green-700 bg-[url('/pattern.png')] bg-cover bg-center bg-no-repeat px-4 sm:px-1 py-8 sm:py-24 text-white sm:flex-row lg:px-5 xl:max-h-[598px] 2xl:rounded-[20px] mx-4 sm:mx-6 lg:mx-25">
        <div className="z-20 flex w-full flex-1 flex-col items-start justify-center gap-8 sm:gap-12 ml-0 sm:ml-20">
          <h2 className="font-bold text-3xl sm:text-4xl md:text-5xl lg:bold-64 xl:max-w-[320px] leading-tight">
            Start Your Safe Journey!
          </h2>
          <p className="text-lg sm:text-2xl md:text-3xl text-gray-10">Your safety companion - Available on iOS and Android</p>
          <div className="flex w-full flex-col gap-3 whitespace-nowrap sm:xl:flex-row">
            <Button
              size="lg"
              variant="outline"
              className="text-black bg-white hover:bg-gray-100 w-full sm:w-auto"
              onClick={() => router.push('/map')}
            >
              Explore Safety Map
            </Button>

            <Button
              size="lg"
              type="button"
              variant="outline"
              className="text-black bg-white hover:bg-gray-100 w-full sm:w-auto"
              onClick={() => window.open('https://expo.dev/accounts/anik_paul003/projects/guardioFinal/builds/65190916-75cf-4be2-abdc-dac8385ef599', '_blank')}
            >
              Download App
            </Button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center sm:justify-end mt-8 sm:mt-0">
          <Image 
            src="/phones.png" 
            alt="phones" 
            width={550} 
            height={870} 
            className="w-[280px] sm:w-[400px] lg:w-[550px] h-auto"
          />
        </div>
      </div>
    </section>
  );
};

export default GetApp;
