
import axios from 'axios';

// Fallback images in case API fails or returns no results
const FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop", // General Travel
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop", // Beach
    "https://images.unsplash.com/photo-1519681393784-d8e5b5a4570e?q=80&w=2074&auto=format&fit=crop", // Mountains
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=2144&auto=format&fit=crop", // City
];

export async function fetchDestinationImage(destination: string): Promise<string> {
    try {
        // Use Wikimedia API to find a relevant image
        // 1. Search for the page
        const searchRes = await axios.get("https://en.wikipedia.org/w/api.php", {
            params: {
                action: "query",
                format: "json",
                list: "search",
                srsearch: `${destination} travel landmark`,
                origin: "*",
                srlimit: 1
            }
        });

        const page = searchRes.data?.query?.search?.[0];
        if (!page) throw new Error("No page found");

        // 2. Get the main image for that page
        const imageRes = await axios.get("https://en.wikipedia.org/w/api.php", {
            params: {
                action: "query",
                format: "json",
                prop: "pageimages",
                piprop: "original",
                titles: page.title,
                origin: "*"
            }
        });

        const pages = imageRes.data?.query?.pages;
        const pageId = Object.keys(pages)[0];
        const imageUrl = pages[pageId]?.original?.source;

        if (imageUrl) return imageUrl;
        throw new Error("No image found on page");

    } catch (error) {
        console.warn("Failed to fetch image from Wiki, using fallback", error);
        // Return a random fallback
        return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
    }
}
