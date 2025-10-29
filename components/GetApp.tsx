"use client";
import React from "react";
import Image from "next/image";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

const GetApp = () => {
  const router = useRouter();
  
  return (
    <section className="flex items-center justify-center w-full flex-col pb-[100px] mx-auto">
      <div className="relative flex w-full flex-col justify-between gap-32 overflow-hidden bg-green-700 bg-[url('/pattern.png')] bg-cover bg-center bg-no-repeat px-1 py-12 text-white sm:flex-row sm:gap-12 sm:py-24 lg:px-5 xl:max-h-[598px] 2xl:rounded-[20px] mx-50 sm:mx-6 lg:mx-25">
        <div className="z-20 flex w-full flex-1 flex-col items-start justify-center gap-12 ml-20">
          <h2 className="font-bold text-5xl lg:bold-64 xl:max-w-[320px]">
            Start Your Safe Journey!
          </h2>
          <p className="text-3xl text-gray-10">Your safety companion - Available on iOS and Android</p>
          <div className="flex w-full flex-col gap-3 whitespace-nowrap xl:flex-row">
            <Button
              size="lg"
              variant="outline"
              className="text-black bg-white hover:bg-gray-100"
              onClick={() => router.push('/map')}
            >
              Explore Safety Map
            </Button>

            <Button
              size="lg"
              type="button"
              variant="outline"
              className="text-black bg-white hover:bg-gray-100"
            >
              Download App
            </Button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end">
          <Image src="/phones.png" alt="phones" width={550} height={870} />
        </div>
      </div>
    </section>
  );
};

export default GetApp;
