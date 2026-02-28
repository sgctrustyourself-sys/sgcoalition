import React, { useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from 'react-tooltip';

// US GeoJSON URL (Standard Albers USA projection)
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface StateData {
    id: string; // State Code (e.g., 'TX', 'CA')
    name: string;
    count: number;
    lastActive: string; // '2m ago'
}

interface LiveMapProps {
    data: StateData[];
    timeRange: '24h' | '7d' | '30d';
}

const LiveMap: React.FC<LiveMapProps> = ({ data, timeRange }) => {
    const [tooltipContent, setTooltipContent] = useState('');

    // Color Scale: Dark to Bright Purple based on order count
    const colorScale = scaleLinear<string>()
        .domain([0, Math.max(...data.map(d => d.count), 1)])
        .range(["#1f2937", "#a855f7"]); // Gray-800 to Purple-500

    return (
        <div className="relative w-full h-full min-h-[400px] bg-black rounded-3xl overflow-hidden border border-gray-800 shadow-2xl">
            {/* Map Container */}
            <ComposableMap projection="geoAlbersUsa" className="w-full h-full">
                <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                        geographies.map((geo) => {
                            // Find data for this state
                            // Note: us-atlas uses names or FIPS. We match by name for simplicity in this mock.
                            // In prod, use FIPS codes for robustness.
                            const stateName = geo.properties.name;
                            const stateData = data.find(d => d.name === stateName);
                            const count = stateData ? stateData.count : 0;

                            return (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    fill={stateData ? colorScale(count) : "#1f2937"}
                                    stroke="#000"
                                    strokeWidth={0.5}
                                    style={{
                                        default: { outline: "none", transition: "all 0.3s" },
                                        hover: { fill: "#d8b4fe", outline: "none", cursor: "pointer" }, // Purple-300 on hover
                                        pressed: { outline: "none" },
                                    }}
                                    onMouseEnter={() => {
                                        setTooltipContent(`${stateName}: ${count} Orders`);
                                    }}
                                    onMouseLeave={() => {
                                        setTooltipContent('');
                                    }}
                                    data-tooltip-id="map-tooltip"
                                    data-tooltip-content={`${stateName}: ${count} Orders${stateData?.lastActive ? ` • Last: ${stateData.lastActive}` : ''}`}
                                />
                            );
                        })
                    }
                </Geographies>

                {/* Pulse Markers for 'hot' states (arbitrary threshold for demo) */}
                {data.filter(d => d.count > 5).map((d) => (
                    <Marker key={d.id} coordinates={getStateCoordinates(d.id)}>
                        <circle r={4} fill="#fff" />
                        <motion.circle
                            r={10}
                            fill="none"
                            stroke="#fff"
                            strokeWidth={2}
                            initial={{ opacity: 1, scale: 0 }}
                            animate={{ opacity: 0, scale: 2 }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeOut"
                            }}
                        />
                    </Marker>
                ))}
            </ComposableMap>

            {/* Floating Tooltip */}
            <Tooltip id="map-tooltip" className="z-50 !bg-gray-900 !text-white !opacity-100 !px-4 !py-2 !rounded-xl !border !border-gray-700 !font-bold !uppercase !tracking-widest !text-xs !shadow-xl" />

            {/* Legend / Info */}
            <div className="absolute bottom-6 right-6 flex items-center gap-2">
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-gray-800 rounded-full"></span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Low</span>
                </div>
                <div className="w-16 h-1 bg-gradient-to-r from-gray-800 to-purple-500 rounded-full"></div>
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-purple-500 rounded-full shadow-[0_0_10px_purple]"></span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">High</span>
                </div>
            </div>
        </div>
    );
};

// Helper: Approximate centroids for major states for demo markers
// In a real app, use a proper centroid library or the geojson properties
function getStateCoordinates(id: string): [number, number] {
    const coords: Record<string, [number, number]> = {
        'CA': [-119.4179, 36.7783],
        'TX': [-99.9018, 31.9686],
        'NY': [-74.0060, 40.7128],
        'FL': [-81.5158, 27.6648],
        'WA': [-120.7401, 47.7511],
        // Add more as needed for the demo markers
    };
    return coords[id] || [-98.5795, 39.8283]; // Default to center US
}

export default LiveMap;
