'use client';

import { ArrowRight, Smartphone, MapPin, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const steps = [
  {
    icon: Smartphone,
    title: 'Download & Register',
    description: 'Install Guardio app, create your blockchain digital ID, and set up emergency contacts with biometric verification.',
    color: 'from-green-500 to-emerald-600'
  },
  {
    icon: MapPin,
    title: 'Enable Location Services',
    description: 'Activate geo-fencing and AI monitoring. Set safe zones and travel preferences for personalized protection.',
    color: 'from-blue-500 to-blue-600'
  },
  {
    icon: Shield,
    title: 'Stay Protected',
    description: 'Travel with confidence. AI monitors your safety, geo-fencing tracks your location, and emergency response is always ready.',
    color: 'from-purple-500 to-purple-600'
  }
];

export function HowItWorks() {
  return (
    <section className="py-24" id="how-it-works">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            How{' '}
            <span className="bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
              Guardio
            </span>
            {' '}Protects You
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Three simple steps to activate comprehensive tourist safety monitoring and protection system.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connection lines for desktop */}
            <div className="hidden md:block absolute top-1/2 left-1/3 w-1/3 h-0.5 bg-gradient-to-r from-primary/50 to-accent/50 transform -translate-y-1/2" />
            <div className="hidden md:block absolute top-1/2 left-2/3 w-1/3 h-0.5 bg-gradient-to-r from-primary/50 to-accent/50 transform -translate-y-1/2" />

            {steps.map((step, index) => (
              <div key={index} className="relative">
                <Card className="h-full border-2 hover:border-green-600/50 transition-all duration-300 hover:shadow-xl group">
                  <CardContent className="p-8 text-center">
                    {/* Step number */}
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                    </div>

                    {/* Icon */}
                    <div className="mb-6">
                      <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${step.color} p-4 group-hover:scale-110 transition-transform duration-300`}>
                        <step.icon className="w-8 h-8 text-white" />
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="text-2xl font-bold mb-4 group-hover:text-primary transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>

                {/* Arrow for mobile */}
                {index < steps.length - 1 && (
                  <div className="md:hidden flex justify-center my-8">
                    <ArrowRight className="w-6 h-6 text-primary/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}