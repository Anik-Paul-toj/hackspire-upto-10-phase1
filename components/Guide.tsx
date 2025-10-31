import Image from 'next/image'
import React from 'react'

const Guide = () => {
  return (
    <section id="guide" className="flex items-center justify-center flex-col">
      <div className="px-6 lg:px-20 3xl:px-0 mx-auto max-w-[1440px] w-full pb-24">
        <Image src="/camp.svg" alt="camp" width={50} height={50} />
        <p className="uppercase font-semibold text-lg -mt-2 mb-3 text-green-500">
          Tourist Safety System
        </p>
        <div className="flex flex-wrap justify-between gap-5 lg:gap-10">
          <h2 className="bold-40 lg:bold-40 xl:max-w-[390px]">Guiding Safe Journeys with AI &amp; Geo-Fencing</h2>
          <p className="regular-16 text-gray-30 xl:max-w-[520px]">Explore with confidence — our app combines offline maps, AI-powered incident detection, geo-fencing alerts and blockchain-backed digital IDs to monitor visitor safety, verify identities, and coordinate rapid incident response across destinations.</p>
        </div>
      </div>

      <div className="flex items-center justify-center mx-auto max-w-[1440px] relative w-full rounded-2xl">
        <Image 
          src="/boat.png"
          alt="boat"
          width={1440}
          height={580}
          className="w-full object-cover object-center rounded-2xl 2xl:rounded-5xl "
        />

        <div className="absolute flex bg-white py-8 pl-5 pr-7 gap-3 rounded-3xl border shadow-md md:left-[5%] lg:top-20">
          <Image 
            src="/meter.svg"
            alt="meter"
            width={16}
            height={158}
            className="h-full w-auto"
          />
          <div className="flexBetween flex-col">
            <div className='flex w-full flex-col'>
              <div className="flexBetween w-full">
                <p className="regular-16 text-gray-20">Destination</p>
                <p className="bold-16 text-green-50">48 min</p>
              </div>
              <p className="bold-20 mt-2">Aguas Calientes</p>
            </div>

            <div className='flex w-full flex-col'>
              <p className="regular-16 text-gray-20">Start track</p>
              <h4 className="bold-20 mt-2 whitespace-nowrap">Wonorejo Pasuruan</h4>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Guide