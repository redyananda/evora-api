import z from 'zod'
import { EventCategory } from '../generated/prisma/enums.js'

// Sent as multipart/form-data (the thumbnail is a file), so every text field
// arrives as a string — numbers and dates have to be coerced.
export const createEventSchema = z
    .object({
        eventName: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required"),
        category: z.enum(EventCategory, { message: "Category is invalid" }),
        price: z.coerce.number().min(0, "Price cannot be negative"),
        venue: z.string().min(1, "Venue is required"),
        location: z.string().min(1, "Location is required"),
        startDate: z.coerce.date({ message: "Start Date is invalid" }),
        endDate: z.coerce.date({ message: "End Date is invalid" }),
        totalSeats: z.coerce.number().int().min(1, "Total Seats is required"),
    })
    .refine((data) => data.endDate >= data.startDate, {
        message: "End Date must be after Start Date",
        path: ["endDate"],
    })

export type CreateEventSchema = z.infer<typeof createEventSchema>


// {
//     "id": 3,
//     "eventName": "Nusantara Food Festival",
//     "description": "Perayaan kuliner terbesar yang menghadirkan ratusan tenant dari seluruh Nusantara hingga masakan internasional. Nikmati cita rasa autentik, demo masak dari chef ternama, kompetisi kuliner, dan area jajanan malam yang menggugah selera. Sebuah surga bagi para pecinta makanan dan pemburu rasa.",
//     "slug": "nusantara-food-festival",
//     "category": "FOOD_AND_DRINK",
//     "price": 150000,
//     "venue": "Senayan Park",
//     "location": "Jakarta",
//     "startDate": "2026-08-15T11:00:00.000Z",
//     "endDate": "2026-08-17T22:00:00.000Z",
//     "totalSeats": 25000,
//     "availableSeats": 25000,
//     "organizerId": 2,
//     "thumbnail": "https://res.cloudinary.com/te0f6gvk/image/upload/v1783581322/nusantara_food_gyb6ow.webp",
//     "createdAt": "2026-07-07T10:41:54.924Z",
//     "updatedAt": "2026-07-07T10:41:54.924Z",
//     "organizer": {
//         "organizerName": "Seoul Sonic",
//         "organizerLogo": null,
//         "rating": 0,
//         "totalReviews": 0
//     }
// }