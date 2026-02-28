import React from 'react';
import { PenTool, Shirt, Package, Building, SprayCan, Music, TrendingUp, ArrowRight } from 'lucide-react';

const Story = () => {
    return (
        <div className="bg-white w-full overflow-hidden">
            {/* Hero Section */}
            <div className="relative h-[80vh] w-full bg-black flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-60">
                    <img 
                        src="/story-hero.png" 
                        alt="Gmoneyworld Hero" 
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="relative z-10 text-center px-4">
                    <h1 className="font-display text-6xl md:text-9xl font-bold text-white uppercase tracking-tighter mb-4 animate-fade-in">
                        Gmoneyworld
                    </h1>
                    <p className="text-gray-300 text-lg md:text-2xl font-medium tracking-widest uppercase">
                        More Than A Brand. It's A Movement.
                    </p>
                </div>
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
            </div>

            {/* Emotional Origin Story */}
            <section className="py-24 px-4 max-w-4xl mx-auto text-center">
                <h2 className="font-display text-4xl font-bold uppercase mb-8">The Origin</h2>
                <p className="text-xl md:text-3xl font-medium leading-relaxed text-gray-900 mb-12">
                    Coalition was born from <span className="text-brand-accent">loss</span>. 
                    <br /><br />
                    After losing my best friend and blood cousin, the world stopped. 
                    Grief turned into a need for an outlet. That outlet became a promise.
                    <br /><br />
                    To keep going. To build something that lasts. To turn pain into power.
                </p>
                <div className="w-24 h-1 bg-black mx-auto"></div>
            </section>

            {/* Founder Background */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h3 className="font-display text-3xl font-bold uppercase mb-6">The Grind</h3>
                        <p className="text-lg text-gray-700 leading-loose mb-6">
                            Started in a basement with nothing but a vision. 
                            I taught myself to sew, learned the tech, and built this site line by line.
                        </p>
                        <p className="text-lg text-gray-700 leading-loose">
                            Between balancing life pressure, making music, and hustling for better days, 
                            Coalition became the proof that you can build a universe from scratch.
                        </p>
                    </div>
                    <div className="relative h-96 bg-black rounded-lg overflow-hidden shadow-2xl transform rotate-2 hover:rotate-0 transition-all duration-500">
                        {/* Placeholder for Founder Image or abstract grind visual - using Mission graphic as fallback/accent */}
                        <img 
                            src="/story-mission.png" 
                            alt="The Grind" 
                            className="w-full h-full object-cover opacity-80 hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute bottom-0 left-0 p-6">
                            <p className="text-white font-bold text-xl uppercase tracking-widest">Built From Nothing</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mission Graphic Section */}
            <section className="relative py-32 bg-black text-white overflow-hidden">
                <div className="absolute inset-0 opacity-40">
                     <img 
                        src="/story-mission.png" 
                        alt="Mission Graphic" 
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
                    <h2 className="font-display text-5xl md:text-7xl font-bold uppercase mb-8">Resilience</h2>
                    <p className="text-xl md:text-2xl font-light leading-relaxed text-gray-300">
                        Crosses for the burdens we carry. Angels for the ones watching over us.
                        <br />
                        <span className="text-white font-bold mt-4 block">
                            Gmoneyworld is about surviving everything and creating something bigger.
                        </span>
                    </p>
                </div>
            </section>

            {/* Timeline Section */}
            <section className="py-24 px-4 max-w-5xl mx-auto">
                <h2 className="font-display text-4xl font-bold uppercase mb-16 text-center">The Journey</h2>
                
                <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
                    
                    {/* Timeline Item 1 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-gray-900 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <PenTool className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Inception</div>
                            <div className="text-gray-700 text-sm">First logo sketches. The vision takes shape.</div>
                        </div>
                    </div>

                    {/* Timeline Item 2 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-black text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Shirt className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">First Drop</div>
                            <div className="text-gray-700 text-sm">The first hoodie. Physical manifestation of the brand.</div>
                        </div>
                    </div>

                    {/* Timeline Item 3 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-brand-accent text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Package className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Validation</div>
                            <div className="text-gray-700 text-sm">First orders shipping out. The community begins to grow.</div>
                        </div>
                    </div>

                    {/* Timeline Item 4 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-gray-800 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Building className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Expansion</div>
                            <div className="text-gray-700 text-sm">New office space. Moving out of the basement.</div>
                        </div>
                    </div>

                     {/* Timeline Item 5 */}
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-gray-900 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <SprayCan className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">The Grind</div>
                            <div className="text-gray-700 text-sm">Stash cans and late nights. Hustling for the vision.</div>
                        </div>
                    </div>

                     {/* Timeline Item 6 */}
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-purple-600 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Music className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Soundtrack</div>
                            <div className="text-gray-700 text-sm">Music dropping. The culture expands beyond clothes.</div>
                        </div>
                    </div>

                     {/* Timeline Item 7 */}
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-black text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Comeback</div>
                            <div className="text-gray-700 text-sm">Rebuilds and resilience. Stronger than ever.</div>
                        </div>
                    </div>

                </div>
            </section>

            {/* Brand Message / Footer Callout */}
            <section className="py-32 bg-brand-black text-white text-center px-4">
                <div className="max-w-3xl mx-auto">
                    <h2 className="font-display text-4xl md:text-6xl font-bold uppercase mb-8">
                        Turn Losses Into Movement
                    </h2>
                    <p className="text-xl text-gray-400 mb-12">
                        Unity. Creativity. Rising from the struggle.
                    </p>
                    <a href="#/shop" className="inline-flex items-center bg-white text-black px-8 py-4 font-bold uppercase tracking-widest hover:bg-brand-accent hover:text-white transition-all duration-300">
                        Join The Movement <ArrowRight className="ml-2 w-5 h-5" />
                    </a>
                </div>
            </section>
        </div>
    );
};

export default Story;
