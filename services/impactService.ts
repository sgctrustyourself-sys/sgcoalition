import { useState, useEffect } from 'react';

export interface ImpactPartner {
    id: string;
    name: string;
    type: string; // e.g., "Homeless Shelter", "Women's Center"
    location: string; // City, State
    mission: string;
    website: string;
    logo?: string; // Optional path to logo
    regionCodes: string[]; // Zip codes or state codes (e.g., "MD", "21201")
}

export interface ImpactMessageData {
    month: string;
    partner: ImpactPartner;
    message: string;
}

// ==========================================
// PARTNER REGISTRY (Verified 501(c)(3))
// ==========================================
const BALTIMORE_PARTNERS: ImpactPartner[] = [
    {
        id: 'pauls-place',
        name: "Paul's Place",
        type: "Outreach Center",
        location: "Baltimore, MD",
        mission: "Improvements to the quality of life in the Washington Village/Pigtown neighborhood.",
        website: "https://paulsplaceoutreach.org/",
        regionCodes: ['MD', '212'],
    },
    {
        id: 'house-of-ruth',
        name: "House of Ruth Maryland",
        type: "Intimate Partner Violence Center",
        location: "Baltimore, MD",
        mission: "Ending violence against women and their children by confronting the attitudes, behaviors and systems that perpetuate it.",
        website: "https://hruth.org/",
        regionCodes: ['MD', '212'],
    },
    {
        id: 'sharp-dressed-man',
        name: "Sharp Dressed Man",
        type: "Workforce Re-entry",
        location: "Baltimore, MD",
        mission: "Providing recycled business attire to men in workforce training and re-entry programs.",
        website: "https://www.sharpdressedman.org/",
        regionCodes: ['MD', '212'],
    },
    {
        id: 'health-care-homeless',
        name: "Health Care for the Homeless",
        type: "Health & Housing",
        location: "Baltimore, MD",
        mission: "Working to prevent and end homelessness for vulnerable individuals and families.",
        website: "https://www.hchmd.org/",
        regionCodes: ['MD', '212'],
    }
];

// Fallback for non-local or unknown regions
const NATIONAL_PARTNERS: ImpactPartner[] = [
    {
        id: 'soles-4-souls',
        name: "Soles4Souls",
        type: "Global Relief",
        location: "National",
        mission: "Turning shoes and clothing into opportunities for education and employment.",
        website: "https://soles4souls.org/",
        regionCodes: ['US'],
    }
];

// ==========================================
// LOGIC
// ==========================================

export const getImpactDetails = (zipCode?: string): ImpactMessageData => {
    const date = new Date();
    const currentMonth = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    const monthIndex = date.getMonth(); // 0-11

    // 1. Determine Region (Simple Logic for now, defaults to Baltimore if no zip or MD zip)
    const isBaltimoreArea = !zipCode || zipCode.startsWith('21') || zipCode.toLowerCase() === 'baltimore';

    // 2. Select Partner Registry based on Region
    const registry = isBaltimoreArea ? BALTIMORE_PARTNERS : NATIONAL_PARTNERS;

    // 3. Rotate Partner based on Month Index
    // Use modulo to cycle through the list seamlessly
    const partnerIndex = monthIndex % registry.length;
    const selectedPartner = registry[partnerIndex];

    // 4. Generate Message
    const messages = [
        `This item supports our monthly donation to ${selectedPartner.name}, a local ${selectedPartner.type.toLowerCase()} in ${selectedPartner.location}.`,
        `Your purchase helps fund essential resources for ${selectedPartner.name} in ${selectedPartner.location}.`,
        `Proceeds from this order contribute to ${selectedPartner.name}'s mission of ${selectedPartner.mission.toLowerCase().replace(/\.$/, '')}.`
    ];

    // Rotate message based on day of month to keep it fresh but consistent for the day
    const dayIndex = date.getDate() % messages.length;

    return {
        month: currentMonth,
        partner: selectedPartner,
        message: messages[dayIndex]
    };
};
