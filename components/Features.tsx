import { FEATURES } from '@/constants'
import Image from 'next/image'
import React from 'react'

const Features = () => {
  return (
    <section id="features" className="py-24 lg:py-32 bg-white">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-20 3xl:px-0 relative w-full flex justify-end">
        {/* Clean Phone Image Section */}
        <div className="flex flex-1 lg:min-h-[900px] relative">
          <Image
            src="/phone.png"
            alt="phone"
            width={440}
            height={1000}
            className="absolute pl-5 top-[13%] z-10 hidden max-w-[1500px] rotate-15 md:-left-16 lg:flex mx-10 hover:rotate-12 transition-transform duration-300"
          />
        </div>

        <div className="z-20 flex w-full flex-col lg:w-[60%]">
          {/* Clean Header Section */}
          <div className='relative mb-16'>
            {/* Clean Badge */}
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-green-50 border border-green-200 mb-8">
              <Image
                src="/camp.svg"
                alt="camp"
                width={20}
                height={20}
                className="w-5 h-5"
              />
              <span className="text-sm font-semibold text-green-700 tracking-wide">ADVANCED FEATURES</span>
            </div>
            
            <h2 className="font-bold text-5xl lg:text-5xl mb-6 leading-tight text-gray-900">
              Powerful
              <br />
              <span className="text-green-600">Safety Features</span>
            </h2>
            
            <p className="text-xl text-gray-600 max-w-2xl leading-relaxed">
              Experience cutting-edge technology designed to keep tourists safe with blockchain security, 
              AI-powered monitoring, and real-time emergency response systems.
            </p>
          </div>
          
          <ul className="grid gap-8 md:grid-cols-2 lg:gap-10">
            {FEATURES.map((feature, index) => (
              <FeatureItem 
                key={feature.title}
                title={feature.title} 
                icon={feature.icon}
                description={feature.description}
                index={index}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

type FeatureItem = {
  title: string;
  icon: string;
  description: string;
  index: number;
}

const FeatureItem = ({ title, icon, description, index }: FeatureItem) => {
  const colors = [
    { 
      bg: 'bg-green-600', 
      hover: 'group-hover:bg-green-700',
      border: 'border-green-200',
      accent: 'text-green-600'
    },
    { 
      bg: 'bg-blue-600', 
      hover: 'group-hover:bg-blue-700',
      border: 'border-blue-200',
      accent: 'text-blue-600'
    },
    { 
      bg: 'bg-purple-600', 
      hover: 'group-hover:bg-purple-700',
      border: 'border-purple-200',
      accent: 'text-purple-600'
    },
    { 
      bg: 'bg-orange-600', 
      hover: 'group-hover:bg-orange-700',
      border: 'border-orange-200',
      accent: 'text-orange-600'
    }
  ];
  
  const colorScheme = colors[index % colors.length];

  return (
    <li className="group">
      {/* Clean Professional Card */}
      <div className={`bg-white border-2 ${colorScheme.border} rounded-2xl p-8 hover:border-gray-300 transition-all duration-300 h-full`}>
        {/* Content */}
        <div>
          {/* Clean Icon Container */}
          <div className="mb-8 flex items-start justify-between">
            <div className={`w-16 h-16 lg:w-18 lg:h-18 rounded-2xl ${colorScheme.bg} ${colorScheme.hover} p-4 transition-colors duration-300 flex items-center justify-center`}>
              <Image 
                src={icon} 
                alt={title} 
                width={28} 
                height={28} 
                className="w-7 h-7 object-contain filter brightness-0 invert"
              />
            </div>
            
            {/* Clean Number Badge */}
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
              <span className="text-lg font-bold text-gray-700">0{index + 1}</span>
            </div>
          </div>
          
          {/* Clean Title */}
          <h2 className="text-lg lg:text-xl font-bold mb-3 text-gray-900 leading-tight">
            {title}
          </h2>
          
          {/* Clean Description */}
          <p className="text-gray-600 leading-relaxed text-sm lg:text-base">
            {description}
          </p>
        </div>
      </div>
    </li>
  )
}

export default Features