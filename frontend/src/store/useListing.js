import { create } from "zustand";
import { persist } from "zustand/middleware"

export const useListingStore = create(
    persist(
        (set, get) => ({
            listing: [],
            setListing: (data) => set({ listing: data }),
            getListingId: (id) => {
                return get().listing.find(
                    (item) => Number(item.ListingId) === Number(id))
            }
        }),
        {
            name: "listing-storage"
        }
    )
)