/**
 * TableGH seed script — 15 Accra restaurants with realistic data.
 * Run: npm run db:seed
 *
 * Covers all neighborhoods, cuisine types, and venue categories.
 */

import { PrismaClient, DayOfWeek, Prisma } from "@prisma/client";

const db = new PrismaClient();

// Helper: minutes since midnight
const t = (h: number, m = 0) => h * 60 + m;

// Helper: generate a slug
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function standardHours(
  openH: number,
  closeH: number,
  closedDays: DayOfWeek[] = []
): Prisma.OperatingHoursCreateWithoutRestaurantInput[] {
  return DAYS.map((day) => ({
    dayOfWeek: day,
    openTime: t(openH),
    closeTime: t(closeH),
    isClosed: closedDays.includes(day),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant definitions
// ─────────────────────────────────────────────────────────────────────────────

const restaurants = [
  // 1. Fine dining — Osu
  {
    name: "Santoku",
    description:
      "Accra's premier Japanese-fusion restaurant. Chef Kwame Asante marries Ghanaian ingredients with Japanese precision — think tilapia sashimi and jollof risotto with a view of Osu Oxford Street.",
    shortBio: "Japanese-fusion fine dining on Oxford Street",
    neighborhood: "OSU" as const,
    address: "23 Oxford Street, Osu, Accra",
    latitude: 5.5558,
    longitude: -0.1736,
    cuisineTags: ["GHANAIAN", "CHINESE"] as const,
    venueCategories: ["FINE_DINING"] as const,
    priceLevel: "FINE" as const,
    phone: "+233302776543",
    features: [
      "OUTDOOR_SEATING",
      "PARKING",
      "ACCEPTS_CARD",
      "ACCEPTS_MOMO",
      "PRIVATE_DINING",
      "WIFI",
    ] as const,
    hours: standardHours(12, 22, ["MONDAY"]),
    tables: [
      { label: "T1", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "T2", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "T3", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "T4", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "T5", capacity: "SIX" as const, minGuests: 4, maxGuests: 6 },
      { label: "PDR-1", capacity: "EIGHT" as const, minGuests: 6, maxGuests: 8 },
    ],
    depositEnabled: true,
    depositAmountPesewas: 15000, // ₵150 per guest
    depositRequiredDays: ["FRIDAY", "SATURDAY"] as const,
    defaultTurnTime: 100,
    menuCategories: [
      {
        name: "Starters",
        items: [
          {
            name: "Tilapia Sashimi",
            description: "Line-caught Lake Volta tilapia, yuzu ponzu, shiso",
            pricePesewas: 9500,
            dietaryTags: ["GLUTEN_FREE"] as const,
            isSignatureDish: true,
          },
          {
            name: "Kelewele Gyoza",
            description: "Pan-fried plantain dumplings, scotch bonnet sauce",
            pricePesewas: 7000,
            dietaryTags: ["VEGAN"] as const,
          },
        ],
      },
      {
        name: "Mains",
        items: [
          {
            name: "Jollof Risotto",
            description:
              "Arborio rice in smoky jollof sauce, tiger prawns, aged parmesan",
            pricePesewas: 19500,
            dietaryTags: [] as const,
            isSignatureDish: true,
            dishSpecialties: ["JOLLOF"] as const,
          },
          {
            name: "Wagyu Kontomire",
            description: "A5 wagyu short rib, slow-braised kontomire, agushi",
            pricePesewas: 35000,
            dietaryTags: [] as const,
          },
        ],
      },
      {
        name: "Desserts",
        items: [
          {
            name: "Chocolate Fufu",
            description: "Dark chocolate sphere, palm nut caramel, coconut cream",
            pricePesewas: 8500,
            dietaryTags: ["VEGETARIAN"] as const,
          },
        ],
      },
      {
        name: "Cocktails",
        items: [
          {
            name: "Accra Mule",
            description: "Akpeteshie, ginger beer, fresh lime, mint",
            pricePesewas: 6500,
            dietaryTags: [] as const,
          },
          {
            name: "Hibiscus Spritz",
            description: "Locally grown sobolo, prosecco, star anise",
            pricePesewas: 5500,
            dietaryTags: [] as const,
          },
        ],
      },
    ],
  },

  // 2. Nigerian — Airport Residential
  {
    name: "Buka Restaurant",
    description:
      "Authentic West African cuisine in a warm, family-run setting. Known for the best suya in Accra and a legendary pepper soup that cures all ailments.",
    shortBio: "Best suya and pepper soup in Accra",
    neighborhood: "AIRPORT_RESIDENTIAL" as const,
    address: "14 Abelemkpe Road, Airport Residential, Accra",
    latitude: 5.6037,
    longitude: -0.1869,
    cuisineTags: ["NIGERIAN", "GHANAIAN"] as const,
    venueCategories: ["CASUAL", "CHOP_BAR"] as const,
    priceLevel: "MODERATE" as const,
    phone: "+233302238901",
    features: [
      "OUTDOOR_SEATING",
      "PARKING",
      "ACCEPTS_MOMO",
      "ACCEPTS_CARD",
      "KID_FRIENDLY",
      "HALAL_CERTIFIED",
    ] as const,
    hours: standardHours(11, 23),
    tables: [
      { label: "B1", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "B2", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "B3", capacity: "SIX" as const, minGuests: 3, maxGuests: 6 },
      { label: "B4", capacity: "EIGHT" as const, minGuests: 4, maxGuests: 8 },
    ],
    depositEnabled: false,
    depositAmountPesewas: null,
    depositRequiredDays: [] as const,
    defaultTurnTime: 90,
    menuCategories: [
      {
        name: "Soups & Starters",
        items: [
          {
            name: "Pepper Soup",
            description: "Goat or catfish, Yoruba spices, uda seeds",
            pricePesewas: 6500,
            dietaryTags: ["GLUTEN_FREE", "HALAL"] as const,
            isSignatureDish: true,
          },
          {
            name: "Suya Platter",
            description: "Spiced grilled beef skewers, onion, tomatoes",
            pricePesewas: 8000,
            dietaryTags: ["GLUTEN_FREE", "HALAL", "SPICY_2"] as const,
            isSignatureDish: true,
          },
        ],
      },
      {
        name: "Mains",
        items: [
          {
            name: "Jollof with Grilled Chicken",
            description: "Party jollof, smoky and rich, with spatchcocked chicken",
            pricePesewas: 9500,
            dietaryTags: ["HALAL"] as const,
            dishSpecialties: ["JOLLOF"] as const,
          },
          {
            name: "Eba and Egusi Soup",
            description: "Cassava fufu, ground melon seed soup, smoked fish",
            pricePesewas: 7500,
            dietaryTags: ["GLUTEN_FREE"] as const,
          },
          {
            name: "Waakye Special",
            description:
              "Rice and beans, gari, spaghetti, wele, fried plantain, stew",
            pricePesewas: 8000,
            dietaryTags: [] as const,
            dishSpecialties: ["WAAKYE"] as const,
          },
        ],
      },
      {
        name: "Drinks",
        items: [
          {
            name: "Zobo Punch",
            description: "Hibiscus, ginger, pineapple, cloves — 1L",
            pricePesewas: 2500,
            dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const,
          },
        ],
      },
    ],
  },

  // 3. Rooftop Bar — East Legon
  {
    name: "Skybar 25",
    description:
      "Accra's highest rooftop lounge, perched 25 floors above East Legon. Sunset cocktails, live Afrobeats every Friday, and a menu that matches the view.",
    shortBio: "Rooftop cocktails and Afrobeats, East Legon",
    neighborhood: "EAST_LEGON" as const,
    address: "25th Floor, Accra Skyline Tower, East Legon",
    latitude: 5.6329,
    longitude: -0.1565,
    cuisineTags: ["CONTINENTAL", "MEDITERRANEAN"] as const,
    venueCategories: ["ROOFTOP", "LOUNGE", "BAR"] as const,
    priceLevel: "UPSCALE" as const,
    phone: "+233302991234",
    features: [
      "OUTDOOR_SEATING",
      "LIVE_MUSIC",
      "PARKING",
      "ACCEPTS_CARD",
      "ACCEPTS_MOMO",
      "ROOFTOP",
      "WIFI",
    ] as const,
    hours: [
      ...["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"].map((d) => ({
        dayOfWeek: d as DayOfWeek,
        openTime: t(17),
        closeTime: t(24),
        isClosed: false,
      })),
      ...["FRIDAY", "SATURDAY"].map((d) => ({
        dayOfWeek: d as DayOfWeek,
        openTime: t(16),
        closeTime: t(2),
        isClosed: false,
      })),
      { dayOfWeek: "SUNDAY" as DayOfWeek, openTime: t(14), closeTime: t(22), isClosed: false },
    ],
    tables: [
      { label: "RT-1", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "RT-2", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "RT-3", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "RT-4", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "VIP-1", capacity: "SIX" as const, minGuests: 4, maxGuests: 6 },
      { label: "VIP-2", capacity: "EIGHT" as const, minGuests: 4, maxGuests: 8 },
    ],
    depositEnabled: true,
    depositAmountPesewas: 10000, // ₵100 per guest
    depositRequiredDays: ["FRIDAY", "SATURDAY"] as const,
    defaultTurnTime: 120,
    menuCategories: [
      {
        name: "Sharing Plates",
        items: [
          {
            name: "Truffle Fries",
            description: "Hand-cut, truffle oil, parmesan, rosemary",
            pricePesewas: 7500,
            dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] as const,
          },
          {
            name: "Crispy Calamari",
            description: "Lemon aioli, harissa dipping sauce",
            pricePesewas: 9000,
            dietaryTags: [] as const,
          },
        ],
      },
      {
        name: "Mains",
        items: [
          {
            name: "Ribeye (300g)",
            description: "Dry-aged 21 days, chimichurri, roasted garlic butter",
            pricePesewas: 32000,
            dietaryTags: ["GLUTEN_FREE"] as const,
            isSignatureDish: true,
          },
          {
            name: "Seafood Linguine",
            description: "Tiger prawns, squid, mussels, cherry tomato, white wine",
            pricePesewas: 22000,
            dietaryTags: [] as const,
          },
        ],
      },
      {
        name: "Cocktails",
        items: [
          {
            name: "Sky Negroni",
            description: "Gin, Campari, sweet vermouth, orange twist",
            pricePesewas: 8500,
            dietaryTags: [] as const,
            isSignatureDish: true,
          },
          {
            name: "Tropical Margarita",
            description: "Tequila, mango, passionfruit, lime, tajin rim",
            pricePesewas: 9000,
            dietaryTags: [] as const,
          },
          {
            name: "Accra Sling",
            description: "Akpeteshie, amaretto, sobolo, citrus",
            pricePesewas: 7500,
            dietaryTags: [] as const,
          },
        ],
      },
    ],
  },

  // 4. Lebanese — Cantonments
  {
    name: "Coco Lounge",
    description:
      "An Accra institution since 2008. Lebanese-Mediterranean mezze, wood-fired pizzas, and a cocktail menu that launched a thousand Instagram posts.",
    shortBio: "Lebanese mezze and cocktails, Cantonments classic",
    neighborhood: "CANTONMENTS" as const,
    address: "7 Ambassadorial Enclave, Cantonments, Accra",
    latitude: 5.5734,
    longitude: -0.179,
    cuisineTags: ["LEBANESE", "MEDITERRANEAN", "PIZZA"] as const,
    venueCategories: ["LOUNGE", "CASUAL"] as const,
    priceLevel: "UPSCALE" as const,
    phone: "+233302780956",
    features: [
      "OUTDOOR_SEATING",
      "PARKING",
      "SHISHA",
      "LIVE_MUSIC",
      "ACCEPTS_CARD",
      "ACCEPTS_MOMO",
      "WIFI",
    ] as const,
    hours: standardHours(12, 24, ["MONDAY"]),
    tables: [
      { label: "C1", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "C2", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "C3", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "C4", capacity: "SIX" as const, minGuests: 3, maxGuests: 6 },
      { label: "C5", capacity: "EIGHT" as const, minGuests: 4, maxGuests: 8 },
    ],
    depositEnabled: false,
    depositAmountPesewas: null,
    depositRequiredDays: [] as const,
    defaultTurnTime: 90,
    menuCategories: [
      {
        name: "Mezze",
        items: [
          {
            name: "Mixed Mezze Platter",
            description: "Hummus, baba ganoush, fattoush, pita, kibbeh",
            pricePesewas: 12000,
            dietaryTags: ["VEGETARIAN"] as const,
            isSignatureDish: true,
          },
          {
            name: "Lamb Kofta",
            description: "Spiced ground lamb skewers, tzatziki, pita",
            pricePesewas: 9500,
            dietaryTags: ["HALAL"] as const,
          },
        ],
      },
      {
        name: "Pizzas",
        items: [
          {
            name: "Manakeesh Zaatar",
            description: "Wood-fired, thyme oil, white cheese, tomato",
            pricePesewas: 10000,
            dietaryTags: ["VEGETARIAN"] as const,
          },
          {
            name: "Lahmacun",
            description: "Thin Turkish pizza, spiced lamb, parsley, lemon",
            pricePesewas: 11000,
            dietaryTags: ["HALAL"] as const,
          },
        ],
      },
      {
        name: "Drinks",
        items: [
          {
            name: "Fresh Lemon Mint",
            description: "Pressed lemons, fresh mint, simple syrup",
            pricePesewas: 3000,
            dietaryTags: ["VEGAN"] as const,
          },
          {
            name: "Lebanese Arak",
            description: "Anise spirit, 30cl, with ice and water",
            pricePesewas: 7500,
            dietaryTags: [] as const,
          },
        ],
      },
    ],
  },

  // 5. Steakhouse — Labone
  {
    name: "Urban Grill",
    description:
      "Labone's neighbourhood steakhouse. Australian Angus and local free-range beef, dry-aged in-house, with a 900°C Josper charcoal oven.",
    shortBio: "Dry-aged steaks and craft beer, Labone",
    neighborhood: "LABONE" as const,
    address: "9 Labone Link, Labone, Accra",
    latitude: 5.5672,
    longitude: -0.1693,
    cuisineTags: ["AMERICAN", "BARBECUE"] as const,
    venueCategories: ["CASUAL", "BAR"] as const,
    priceLevel: "UPSCALE" as const,
    phone: "+233302556789",
    features: [
      "OUTDOOR_SEATING",
      "PARKING",
      "SPORTS_TV",
      "ACCEPTS_CARD",
      "ACCEPTS_MOMO",
      "KID_FRIENDLY",
    ] as const,
    hours: standardHours(12, 23, ["MONDAY"]),
    tables: [
      { label: "UG1", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "UG2", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "UG3", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "UG4", capacity: "SIX" as const, minGuests: 3, maxGuests: 6 },
    ],
    depositEnabled: false,
    depositAmountPesewas: null,
    depositRequiredDays: [] as const,
    defaultTurnTime: 90,
    menuCategories: [
      {
        name: "Starters",
        items: [
          {
            name: "Bone Marrow",
            description: "Roasted marrow, sourdough, chimichurri, pickled red onion",
            pricePesewas: 8000,
            dietaryTags: ["GLUTEN_FREE"] as const,
          },
        ],
      },
      {
        name: "Steaks",
        items: [
          {
            name: "Tenderloin 220g",
            description: "21-day dry-aged, Josper-grilled, garlic herb butter",
            pricePesewas: 28000,
            dietaryTags: ["GLUTEN_FREE"] as const,
            isSignatureDish: true,
          },
          {
            name: "Tomahawk 800g",
            description: "Long-bone ribeye to share, served with fries and salad",
            pricePesewas: 65000,
            dietaryTags: ["GLUTEN_FREE"] as const,
          },
          {
            name: "Local Free-Range Sirloin",
            description: "Ghanaian beef, smoked salt, jus gras",
            pricePesewas: 18000,
            dietaryTags: ["GLUTEN_FREE"] as const,
          },
        ],
      },
      {
        name: "Sides",
        items: [
          {
            name: "Mac & Cheese",
            description: "Four-cheese, crispy breadcrumbs",
            pricePesewas: 5000,
            dietaryTags: ["VEGETARIAN"] as const,
          },
          {
            name: "Creamed Spinach",
            description: "Local spinach, nutmeg, cream",
            pricePesewas: 4000,
            dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] as const,
          },
        ],
      },
      {
        name: "Drinks",
        items: [
          {
            name: "Club Premium Draft",
            description: "500ml Club Beer draft",
            pricePesewas: 2500,
            dietaryTags: [] as const,
          },
        ],
      },
    ],
  },

  // 6. Italian — Ridge
  {
    name: "La Piazza",
    description:
      "A slice of Rome on the Ridge. Family recipes from Chef Valentina Marchetti, wood-fired Neapolitan pizzas, and house-made pasta since 2015.",
    shortBio: "Neapolitan pizza and homemade pasta, Ridge",
    neighborhood: "RIDGE" as const,
    address: "3 Gamel Abdul Nasser Avenue, Ridge, Accra",
    latitude: 5.5772,
    longitude: -0.2001,
    cuisineTags: ["ITALIAN", "PIZZA"] as const,
    venueCategories: ["CASUAL", "FINE_DINING"] as const,
    priceLevel: "MODERATE" as const,
    phone: "+233302668912",
    features: [
      "OUTDOOR_SEATING",
      "ACCEPTS_CARD",
      "ACCEPTS_MOMO",
      "KID_FRIENDLY",
      "WHEELCHAIR_ACCESSIBLE",
      "WIFI",
    ] as const,
    hours: standardHours(11, 22, ["MONDAY"]),
    tables: [
      { label: "LP1", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "LP2", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "LP3", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "LP4", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "LP5", capacity: "SIX" as const, minGuests: 3, maxGuests: 6 },
    ],
    depositEnabled: false,
    depositAmountPesewas: null,
    depositRequiredDays: [] as const,
    defaultTurnTime: 80,
    menuCategories: [
      {
        name: "Pizzas",
        items: [
          {
            name: "Margherita D.O.C",
            description: "San Marzano tomato, buffalo mozzarella, fresh basil",
            pricePesewas: 10500,
            dietaryTags: ["VEGETARIAN"] as const,
            isSignatureDish: true,
          },
          {
            name: "Nduja & Honey",
            description: "Spicy Calabrian sausage, honey, stracciatella",
            pricePesewas: 13000,
            dietaryTags: ["SPICY_1"] as const,
          },
        ],
      },
      {
        name: "Pasta",
        items: [
          {
            name: "Cacio e Pepe",
            description: "Tonnarelli, aged pecorino, black pepper — classic Roman",
            pricePesewas: 10000,
            dietaryTags: ["VEGETARIAN"] as const,
            isSignatureDish: true,
          },
          {
            name: "Linguine alle Vongole",
            description: "Clams, white wine, garlic, parsley, chilli",
            pricePesewas: 14000,
            dietaryTags: [] as const,
          },
        ],
      },
      {
        name: "Desserts",
        items: [
          {
            name: "Tiramisu",
            description: "Classic, savoiardi, mascarpone, espresso",
            pricePesewas: 7500,
            dietaryTags: ["VEGETARIAN"] as const,
            isSignatureDish: true,
          },
        ],
      },
      {
        name: "Drinks",
        items: [
          {
            name: "Aperol Spritz",
            description: "Aperol, prosecco, soda, orange slice",
            pricePesewas: 8000,
            dietaryTags: [] as const,
          },
          {
            name: "Italian Sodas",
            description: "Blood orange, lemon, or mint — ask your server",
            pricePesewas: 3000,
            dietaryTags: ["VEGAN"] as const,
          },
        ],
      },
    ],
  },

  // 7. Ghanaian chop bar — Osu
  {
    name: "Abena's Kitchen",
    description:
      "Old-school Accra chop bar reborn. Abena's legendary waakye has been feeding Osu since 1992 — now with proper seating and cold Club beer.",
    shortBio: "Legendary waakye and Ghanaian classics, Osu",
    neighborhood: "OSU" as const,
    address: "45 Ring Road East, Osu, Accra",
    latitude: 5.5531,
    longitude: -0.1721,
    cuisineTags: ["GHANAIAN"] as const,
    venueCategories: ["CHOP_BAR", "CASUAL"] as const,
    priceLevel: "BUDGET" as const,
    phone: "+233242778901",
    features: [
      "ACCEPTS_MOMO",
      "KID_FRIENDLY",
      "HALAL_CERTIFIED",
      "WHEELCHAIR_ACCESSIBLE",
    ] as const,
    hours: [
      ...DAYS.map((d) => ({
        dayOfWeek: d as DayOfWeek,
        openTime: t(7),
        closeTime: t(16),
        isClosed: d === "SUNDAY",
      })),
    ],
    tables: [
      { label: "A1", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "A2", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "A3", capacity: "SIX" as const, minGuests: 2, maxGuests: 6 },
    ],
    depositEnabled: false,
    depositAmountPesewas: null,
    depositRequiredDays: [] as const,
    defaultTurnTime: 60,
    menuCategories: [
      {
        name: "Mains",
        items: [
          {
            name: "Waakye Full House",
            description:
              "Rice and beans, all toppings: wele, kobi, egg, spaghetti, fried fish",
            pricePesewas: 4500,
            dietaryTags: ["HALAL"] as const,
            isSignatureDish: true,
            dishSpecialties: ["WAAKYE"] as const,
          },
          {
            name: "Banku with Okro Stew",
            description: "Fermented corn and cassava dough, fresh okro, fish",
            pricePesewas: 3500,
            dietaryTags: ["GLUTEN_FREE"] as const,
            dishSpecialties: ["BANKU"] as const,
          },
          {
            name: "Fufu and Groundnut Soup",
            description: "Pounded cassava-plantain, peanut broth, lamb",
            pricePesewas: 4000,
            dietaryTags: ["GLUTEN_FREE"] as const,
            dishSpecialties: ["FUFU", "PEANUT_SOUP"] as const,
          },
          {
            name: "Kenkey and Fried Fish",
            description: "Ga kenkey, whole fried tilapia, fresh pepper sauce",
            pricePesewas: 3000,
            dietaryTags: ["GLUTEN_FREE"] as const,
            dishSpecialties: ["TILAPIA"] as const,
          },
        ],
      },
      {
        name: "Sides & Extras",
        items: [
          {
            name: "Kelewele",
            description: "Spiced fried plantain, ginger, cayenne",
            pricePesewas: 1500,
            dietaryTags: ["VEGAN", "GLUTEN_FREE", "SPICY_1"] as const,
            dishSpecialties: ["KELEWELE"] as const,
          },
          {
            name: "Sobolo",
            description: "Chilled hibiscus drink, ginger, cloves — 500ml",
            pricePesewas: 1000,
            dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const,
          },
        ],
      },
    ],
  },

  // 8. Seafood — Tema
  {
    name: "Harbour Catch",
    description:
      "Fresh from Tema's fishing harbour to your plate, daily. Grilled, fried, or in a pot — the freshest seafood in Greater Accra.",
    shortBio: "Fresh harbour seafood, Tema",
    neighborhood: "TEMA" as const,
    address: "Community 1 Beach Road, Tema",
    latitude: 5.6698,
    longitude: 0.0166,
    cuisineTags: ["SEAFOOD", "GHANAIAN"] as const,
    venueCategories: ["CASUAL", "BEACH_BAR"] as const,
    priceLevel: "MODERATE" as const,
    phone: "+233303202456",
    features: [
      "OUTDOOR_SEATING",
      "PARKING",
      "ACCEPTS_MOMO",
      "ACCEPTS_CARD",
      "SEA_VIEW",
      "KID_FRIENDLY",
    ] as const,
    hours: standardHours(10, 22),
    tables: [
      { label: "HC1", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "HC2", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "HC3", capacity: "SIX" as const, minGuests: 2, maxGuests: 6 },
      { label: "HC4", capacity: "EIGHT" as const, minGuests: 4, maxGuests: 8 },
    ],
    depositEnabled: false,
    depositAmountPesewas: null,
    depositRequiredDays: [] as const,
    defaultTurnTime: 90,
    menuCategories: [
      {
        name: "Starters",
        items: [
          {
            name: "Prawn Cocktail",
            description: "Chilled tiger prawns, Marie Rose, iceberg, lemon",
            pricePesewas: 9000,
            dietaryTags: ["GLUTEN_FREE"] as const,
          },
        ],
      },
      {
        name: "Mains",
        items: [
          {
            name: "Whole Grilled Tilapia",
            description: "2kg Volta tilapia, garlic herb sauce, yam fries",
            pricePesewas: 14500,
            dietaryTags: ["GLUTEN_FREE"] as const,
            isSignatureDish: true,
            dishSpecialties: ["TILAPIA"] as const,
          },
          {
            name: "Grilled Lobster",
            description: "Half lobster, lemon butter, garlic toast",
            pricePesewas: 32000,
            dietaryTags: [] as const,
          },
          {
            name: "Mixed Seafood Platter",
            description: "Lobster, prawns, crab, mussels, fried snapper — for 2",
            pricePesewas: 48000,
            dietaryTags: ["GLUTEN_FREE"] as const,
            isSignatureDish: true,
          },
        ],
      },
      {
        name: "Sides",
        items: [
          {
            name: "Kelewele",
            description: "Spiced fried plantain",
            pricePesewas: 2000,
            dietaryTags: ["VEGAN", "SPICY_1"] as const,
            dishSpecialties: ["KELEWELE"] as const,
          },
          {
            name: "Yam Fries",
            description: "Crispy golden yam, chilli dipping sauce",
            pricePesewas: 2500,
            dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const,
          },
        ],
      },
      {
        name: "Drinks",
        items: [
          {
            name: "Fresh Coconut Water",
            description: "Young coconut, chilled",
            pricePesewas: 2000,
            dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const,
          },
        ],
      },
    ],
  },

  // 9-15: Abbreviated but complete entries
  {
    name: "The Lemon Tree",
    description: "Accra's best vegan and plant-based restaurant, East Legon. Zero compromise on flavour.",
    shortBio: "Award-winning vegan cuisine, East Legon",
    neighborhood: "EAST_LEGON" as const,
    address: "12 Boundary Road, East Legon, Accra",
    latitude: 5.636, longitude: -0.153,
    cuisineTags: ["VEGAN", "MEDITERRANEAN", "INDIAN"] as const,
    venueCategories: ["CASUAL", "CAFE"] as const,
    priceLevel: "MODERATE" as const,
    phone: "+233302999012",
    features: ["OUTDOOR_SEATING", "ACCEPTS_MOMO", "ACCEPTS_CARD", "WHEELCHAIR_ACCESSIBLE", "WIFI"] as const,
    hours: standardHours(8, 21, ["MONDAY"]),
    tables: [
      { label: "LT1", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "LT2", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "LT3", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
    ],
    depositEnabled: false, depositAmountPesewas: null, depositRequiredDays: [] as const,
    defaultTurnTime: 75,
    menuCategories: [
      { name: "All Day", items: [
        { name: "Jackfruit Jollof", description: "Slow-braised jackfruit, smoky tomato sauce, plantain", pricePesewas: 8500, dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const, isSignatureDish: true, dishSpecialties: ["JOLLOF"] as const },
        { name: "Mushroom Suya Bowl", description: "Oyster mushroom suya, freekeh, shito vinaigrette", pricePesewas: 9000, dietaryTags: ["VEGAN"] as const },
        { name: "Cashew Cream Curry", description: "Butternut squash, chickpea, coconut milk, brown rice", pricePesewas: 9500, dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const },
        { name: "Avocado Toast", description: "Sourdough, smashed avo, radish, hemp seeds, chilli flakes", pricePesewas: 7000, dietaryTags: ["VEGAN"] as const },
        { name: "Green Detox Smoothie", description: "Spinach, mango, banana, ginger, oat milk", pricePesewas: 3500, dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const },
      ]},
    ],
  },

  {
    name: "Spice Route",
    description: "Authentic Indian cuisine in the heart of Dzorwulu. Chef Rajesh brings Mumbai street food and tandoor classics to Accra.",
    shortBio: "Authentic Mumbai flavours, Dzorwulu",
    neighborhood: "DZORWULU" as const,
    address: "5 Dadeban Road, Dzorwulu, Accra",
    latitude: 5.595, longitude: -0.21,
    cuisineTags: ["INDIAN"] as const,
    venueCategories: ["CASUAL", "FINE_DINING"] as const,
    priceLevel: "MODERATE" as const,
    phone: "+233302112233",
    features: ["PARKING", "ACCEPTS_MOMO", "ACCEPTS_CARD", "HALAL_CERTIFIED", "KID_FRIENDLY"] as const,
    hours: standardHours(12, 22, ["TUESDAY"]),
    tables: [
      { label: "SR1", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "SR2", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "SR3", capacity: "SIX" as const, minGuests: 3, maxGuests: 6 },
    ],
    depositEnabled: false, depositAmountPesewas: null, depositRequiredDays: [] as const,
    defaultTurnTime: 90,
    menuCategories: [
      { name: "Starters", items: [
        { name: "Samosa Chaat", description: "Crispy samosas, tamarind chutney, coriander yogurt", pricePesewas: 5500, dietaryTags: ["VEGETARIAN"] as const, isSignatureDish: true },
        { name: "Seekh Kebab", description: "Minced lamb, ginger, chilli, charcoal-grilled", pricePesewas: 7000, dietaryTags: ["HALAL", "GLUTEN_FREE"] as const },
      ]},
      { name: "Mains", items: [
        { name: "Butter Chicken", description: "Tandoori chicken, creamy tomato-fenugreek sauce, naan", pricePesewas: 10000, dietaryTags: ["HALAL"] as const, isSignatureDish: true },
        { name: "Dal Makhani", description: "Black lentils, cream, overnight cook — legendary", pricePesewas: 8000, dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] as const },
        { name: "Prawn Masala", description: "Tiger prawns, Konkan coast masala, basmati", pricePesewas: 14000, dietaryTags: ["HALAL", "GLUTEN_FREE"] as const },
      ]},
      { name: "Breads", items: [
        { name: "Garlic Naan", description: "Tandoor-baked, fresh garlic, coriander butter", pricePesewas: 2500, dietaryTags: ["VEGETARIAN"] as const },
      ]},
      { name: "Drinks", items: [
        { name: "Mango Lassi", description: "Fresh Alphonso mango, yogurt, cardamom", pricePesewas: 3500, dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] as const },
      ]},
    ],
  },

  {
    name: "Mama Africa",
    description: "Pan-African dining experience celebrating the breadth of the continent's cuisines. From Ethiopian injera to Senegalese thieboudienne.",
    shortBio: "Pan-African cuisine, North Legon",
    neighborhood: "NORTH_LEGON" as const,
    address: "University Avenue, North Legon, Accra",
    latitude: 5.661, longitude: -0.191,
    cuisineTags: ["GHANAIAN", "NIGERIAN", "CONTINENTAL"] as const,
    venueCategories: ["CASUAL", "FINE_DINING"] as const,
    priceLevel: "MODERATE" as const,
    phone: "+233302882200",
    features: ["OUTDOOR_SEATING", "LIVE_MUSIC", "PARKING", "ACCEPTS_MOMO", "ACCEPTS_CARD"] as const,
    hours: standardHours(11, 23),
    tables: [
      { label: "MA1", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "MA2", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "MA3", capacity: "SIX" as const, minGuests: 3, maxGuests: 6 },
      { label: "MA4", capacity: "EIGHT" as const, minGuests: 4, maxGuests: 8 },
    ],
    depositEnabled: false, depositAmountPesewas: null, depositRequiredDays: [] as const,
    defaultTurnTime: 90,
    menuCategories: [
      { name: "Starters", items: [
        { name: "Accra Fritters", description: "Black-eyed pea fritters, shito mayo", pricePesewas: 5000, dietaryTags: ["VEGAN"] as const },
      ]},
      { name: "Mains", items: [
        { name: "Jollof Trio", description: "Ghanaian, Nigerian, Senegalese jollof — judge for yourself", pricePesewas: 12000, dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const, isSignatureDish: true, dishSpecialties: ["JOLLOF"] as const },
        { name: "Thiéboudienne", description: "Senegalese fish-and-rice, national dish", pricePesewas: 11000, dietaryTags: ["GLUTEN_FREE"] as const },
        { name: "Injera Feast", description: "Ethiopian sour flatbread, doro wat, lentil stew, kitfo", pricePesewas: 14000, dietaryTags: ["VEGETARIAN"] as const },
      ]},
      { name: "Drinks", items: [
        { name: "Hibiscus Ginger Cooler", description: "Sobolo, ginger, honey, citrus", pricePesewas: 2500, dietaryTags: ["VEGAN"] as const },
        { name: "Palm Wine", description: "Fresh-tapped, fermented. Ask about today's batch.", pricePesewas: 3500, dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const },
      ]},
    ],
  },

  {
    name: "Kofi's Khebab House",
    description: "Accra's most famous roadside khebab elevated to a sit-down experience. The charcoal never goes cold.",
    shortBio: "Legendary charcoal khebab, Achimota",
    neighborhood: "ACHIMOTA" as const,
    address: "Achimota Overhead, Achimota, Accra",
    latitude: 5.618, longitude: -0.228,
    cuisineTags: ["GHANAIAN"] as const,
    venueCategories: ["CASUAL", "FAST_CASUAL"] as const,
    priceLevel: "BUDGET" as const,
    phone: "+233244567890",
    features: ["OUTDOOR_SEATING", "ACCEPTS_MOMO", "HALAL_CERTIFIED"] as const,
    hours: standardHours(15, 24),
    tables: [
      { label: "K1", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "K2", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "K3", capacity: "SIX" as const, minGuests: 2, maxGuests: 6 },
    ],
    depositEnabled: false, depositAmountPesewas: null, depositRequiredDays: [] as const,
    defaultTurnTime: 60,
    menuCategories: [
      { name: "Khebabs", items: [
        { name: "Beef Khebab (3 sticks)", description: "Charcoal-grilled beef, shito, fresh onion rings", pricePesewas: 3500, dietaryTags: ["HALAL", "GLUTEN_FREE", "SPICY_2"] as const, isSignatureDish: true, dishSpecialties: ["KHEBAB"] as const },
        { name: "Goat Khebab (3 sticks)", description: "Tender goat, spiced marinade, yaji", pricePesewas: 4000, dietaryTags: ["HALAL", "GLUTEN_FREE", "SPICY_1"] as const, dishSpecialties: ["KHEBAB"] as const },
        { name: "Liver Khebab (3 sticks)", description: "Beef liver, green pepper, onion", pricePesewas: 3000, dietaryTags: ["HALAL", "GLUTEN_FREE"] as const, dishSpecialties: ["KHEBAB"] as const },
      ]},
      { name: "Sides", items: [
        { name: "Fried Yam", description: "Crispy, with shito dip", pricePesewas: 2000, dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const },
        { name: "Cold Minerals", description: "Coke, Sprite, Fanta, Malta, Malt", pricePesewas: 1000, dietaryTags: ["VEGAN"] as const },
      ]},
    ],
  },

  {
    name: "Tantra Lounge",
    description: "Spintex Road's premier cocktail lounge and fusion kitchen. DJ every Thursday, bottle service Friday and Saturday.",
    shortBio: "Cocktails and fusion bites, Spintex",
    neighborhood: "SPINTEX" as const,
    address: "Spintex Road, Community 18, Spintex, Accra",
    latitude: 5.633, longitude: -0.084,
    cuisineTags: ["CONTINENTAL", "AMERICAN"] as const,
    venueCategories: ["LOUNGE", "BAR"] as const,
    priceLevel: "UPSCALE" as const,
    phone: "+233302445566",
    features: ["PARKING", "LIVE_MUSIC", "ACCEPTS_CARD", "ACCEPTS_MOMO", "SHISHA"] as const,
    hours: [...["MONDAY", "TUESDAY"].map(d => ({ dayOfWeek: d as DayOfWeek, openTime: t(17), closeTime: t(24), isClosed: true })), ...["WEDNESDAY", "THURSDAY"].map(d => ({ dayOfWeek: d as DayOfWeek, openTime: t(18), closeTime: t(1), isClosed: false })), ...["FRIDAY", "SATURDAY"].map(d => ({ dayOfWeek: d as DayOfWeek, openTime: t(18), closeTime: t(3), isClosed: false })), { dayOfWeek: "SUNDAY" as DayOfWeek, openTime: t(16), closeTime: t(23), isClosed: false }],
    tables: [
      { label: "TN1", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "TN2", capacity: "SIX" as const, minGuests: 4, maxGuests: 6 },
      { label: "VIP-A", capacity: "EIGHT" as const, minGuests: 4, maxGuests: 8 },
    ],
    depositEnabled: true, depositAmountPesewas: 8000, depositRequiredDays: ["FRIDAY", "SATURDAY"] as const,
    defaultTurnTime: 120,
    menuCategories: [
      { name: "Sharing", items: [
        { name: "Wings Roulette", description: "12 wings, 4 different sauces — mild to fire", pricePesewas: 11000, dietaryTags: ["SPICY_3"] as const, isSignatureDish: true },
        { name: "Sliders Trio", description: "Mini beef burgers, truffle mayo, pickled cucumber", pricePesewas: 10000, dietaryTags: [] as const },
      ]},
      { name: "Cocktails", items: [
        { name: "Tantra Special", description: "Dark rum, coconut cream, mango, scotch bonnet syrup", pricePesewas: 9500, dietaryTags: [] as const, isSignatureDish: true },
        { name: "Mojito Classic", description: "White rum, lime, mint, sugar, soda", pricePesewas: 8000, dietaryTags: [] as const },
        { name: "Bottle Service — Hennessy VS", description: "750ml, mixers included", pricePesewas: 75000, dietaryTags: [] as const },
        { name: "Bottle Service — Grey Goose", description: "750ml, mixers included", pricePesewas: 85000, dietaryTags: [] as const },
      ]},
    ],
  },

  {
    name: "The Garden Café",
    description: "All-day breakfast and brunch spot in a lush garden setting. Achimota's favourite Sunday morning destination.",
    shortBio: "All-day brunch in a garden, Dzorwulu",
    neighborhood: "DZORWULU" as const,
    address: "Liberation Road, Dzorwulu, Accra",
    latitude: 5.588, longitude: -0.215,
    cuisineTags: ["CONTINENTAL", "AMERICAN", "VEGAN"] as const,
    venueCategories: ["CAFE", "CASUAL"] as const,
    priceLevel: "MODERATE" as const,
    phone: "+233302773388",
    features: ["OUTDOOR_SEATING", "ACCEPTS_CARD", "ACCEPTS_MOMO", "KID_FRIENDLY", "WHEELCHAIR_ACCESSIBLE", "WIFI"] as const,
    hours: standardHours(7, 18, ["MONDAY"]),
    tables: [
      { label: "GC1", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "GC2", capacity: "TWO" as const, minGuests: 1, maxGuests: 2 },
      { label: "GC3", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "GC4", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
    ],
    depositEnabled: false, depositAmountPesewas: null, depositRequiredDays: [] as const,
    defaultTurnTime: 70,
    menuCategories: [
      { name: "Breakfast & Brunch", items: [
        { name: "Full English Breakfast", description: "Eggs, bacon, sausage, tomato, mushroom, toast", pricePesewas: 8500, dietaryTags: [] as const, isSignatureDish: true },
        { name: "Shakshuka", description: "Poached eggs, spiced tomato, feta, crusty bread", pricePesewas: 7500, dietaryTags: ["VEGETARIAN"] as const },
        { name: "Acai Bowl", description: "Acai, granola, seasonal fruit, coconut flakes, honey", pricePesewas: 8000, dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const },
        { name: "Pancake Stack", description: "3 fluffy pancakes, maple syrup, berries, whipped cream", pricePesewas: 6500, dietaryTags: ["VEGETARIAN"] as const },
      ]},
      { name: "Drinks", items: [
        { name: "Single Origin Pour-Over", description: "Ghanaian Asante beans, filter coffee", pricePesewas: 2500, dietaryTags: ["VEGAN"] as const },
        { name: "Tropical Smoothie Bowl", description: "Mango, pineapple, papaya, chia seeds", pricePesewas: 5500, dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const },
      ]},
    ],
  },

  {
    name: "The Fisherman's Wharf",
    description: "Beachside dining on Laboma Beach. Catch-of-the-day, live music weekends, and sunset views that justify the drive to Tema.",
    shortBio: "Beachside catch-of-the-day dining, Laboma",
    neighborhood: "TEMA" as const,
    address: "Laboma Beach, Community 9, Tema",
    latitude: 5.661, longitude: 0.024,
    cuisineTags: ["SEAFOOD", "GHANAIAN", "CONTINENTAL"] as const,
    venueCategories: ["BEACH_BAR", "CASUAL"] as const,
    priceLevel: "MODERATE" as const,
    phone: "+233303301122",
    features: ["OUTDOOR_SEATING", "LIVE_MUSIC", "PARKING", "ACCEPTS_MOMO", "ACCEPTS_CARD", "SEA_VIEW"] as const,
    hours: standardHours(11, 23),
    tables: [
      { label: "FW1", capacity: "FOUR" as const, minGuests: 1, maxGuests: 4 },
      { label: "FW2", capacity: "FOUR" as const, minGuests: 2, maxGuests: 4 },
      { label: "FW3", capacity: "SIX" as const, minGuests: 3, maxGuests: 6 },
      { label: "FW4", capacity: "EIGHT" as const, minGuests: 4, maxGuests: 8 },
    ],
    depositEnabled: false, depositAmountPesewas: null, depositRequiredDays: [] as const,
    defaultTurnTime: 90,
    menuCategories: [
      { name: "Starters", items: [
        { name: "Fish Yabbies", description: "Lightly battered sea crayfish, garlic butter", pricePesewas: 7500, dietaryTags: [] as const },
      ]},
      { name: "Mains", items: [
        { name: "Catch of the Day", description: "Ask your server. Grilled or fried. With choice of side.", pricePesewas: 16000, dietaryTags: ["GLUTEN_FREE"] as const, isSignatureDish: true },
        { name: "Grilled Grouper", description: "Whole fish, herb crust, lemon, garlic, palm oil sauté", pricePesewas: 22000, dietaryTags: ["GLUTEN_FREE"] as const },
        { name: "Coconut Prawn Curry", description: "King prawns, coconut milk, lemongrass, jasmine rice", pricePesewas: 18000, dietaryTags: ["GLUTEN_FREE"] as const },
      ]},
      { name: "Sides", items: [
        { name: "Jollof Rice", description: "Classic smoky party jollof", pricePesewas: 3000, dietaryTags: ["VEGAN"] as const, dishSpecialties: ["JOLLOF"] as const },
        { name: "Fried Plantain", description: "Sweet ripe plantain", pricePesewas: 2500, dietaryTags: ["VEGAN", "GLUTEN_FREE"] as const },
      ]},
      { name: "Drinks", items: [
        { name: "Coconut Cocktail", description: "Fresh coconut, rum, lime juice, poured back in the coconut", pricePesewas: 8000, dietaryTags: [] as const, isSignatureDish: true },
        { name: "Ice-Cold Club Beer", description: "330ml", pricePesewas: 2000, dietaryTags: [] as const },
      ]},
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Seed execution
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding TableGH database...");

  for (const r of restaurants) {
    console.log(`  → ${r.name}`);

    const restaurant = await db.restaurant.upsert({
      where: { slug: slug(r.name) },
      update: {},
      create: {
        slug: slug(r.name),
        name: r.name,
        description: r.description,
        shortBio: r.shortBio,
        neighborhood: r.neighborhood,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude,
        cuisineTags: { set: [...r.cuisineTags] },
        venueCategories: { set: [...r.venueCategories] },
        priceLevel: r.priceLevel,
        phone: r.phone,
        features: { set: [...r.features] },
        depositEnabled: r.depositEnabled,
        depositAmountPesewas: r.depositAmountPesewas ?? null,
        depositRequiredDays: { set: [...r.depositRequiredDays] },
        defaultTurnTime: r.defaultTurnTime,
        isActive: true,
        isVerified: true,
        ratingAvg: (Math.random() * 1.5 + 3.5).toFixed(2) as unknown as number,
        ratingCount: Math.floor(Math.random() * 200 + 20),
      },
    });

    // Operating hours
    for (const h of r.hours) {
      await db.operatingHours.upsert({
        where: { restaurantId_dayOfWeek: { restaurantId: restaurant.id, dayOfWeek: h.dayOfWeek } },
        update: { openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed },
        create: { restaurantId: restaurant.id, dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed },
      });
    }

    // Tables
    for (const table of r.tables) {
      const existing = await db.restaurantTable.findFirst({
        where: { restaurantId: restaurant.id, label: table.label },
      });
      if (!existing) {
        await db.restaurantTable.create({
          data: { restaurantId: restaurant.id, label: table.label, capacity: table.capacity, minGuests: table.minGuests, maxGuests: table.maxGuests },
        });
      }
    }

    // Seed placeholder photos (3 per restaurant using public placeholder service)
    const photoContexts = ["EXTERIOR", "INTERIOR", "DISH"] as const;
    for (let i = 0; i < photoContexts.length; i++) {
      const ctx = photoContexts[i]!;
      const existing = await db.photo.findFirst({
        where: { restaurantId: restaurant.id, context: ctx },
      });
      if (!existing) {
        await db.photo.create({
          data: {
            restaurantId: restaurant.id,
            url: `https://placehold.co/1200x800/1A1A1A/FAF7F2?text=${encodeURIComponent(r.name + " - " + ctx)}`,
            thumbnailUrl: `https://placehold.co/400x300/1A1A1A/FAF7F2?text=${encodeURIComponent(r.name)}`,
            context: ctx,
            altText: `${r.name} — ${ctx.toLowerCase()}`,
            sortOrder: i,
          },
        });
      }
    }

    // Menu categories and items
    for (const cat of r.menuCategories) {
      let category = await db.menuCategory.findFirst({
        where: { restaurantId: restaurant.id, name: cat.name },
      });
      if (!category) {
        category = await db.menuCategory.create({
          data: {
            restaurantId: restaurant.id,
            name: cat.name,
            sortOrder: r.menuCategories.indexOf(cat),
          },
        });
      }

      for (const item of cat.items) {
        const existing = await db.menuItem.findFirst({
          where: { restaurantId: restaurant.id, name: item.name },
        });
        if (!existing) {
          await db.menuItem.create({
            data: {
              restaurantId: restaurant.id,
              categoryId: category.id,
              name: item.name,
              description: item.description,
              pricePesewas: item.pricePesewas,
              dietaryTags: { set: [...item.dietaryTags] },
              dishSpecialties: { set: "dishSpecialties" in item ? [...(item as {dishSpecialties: readonly string[]}).dishSpecialties] : [] },
              isSignatureDish: "isSignatureDish" in item ? (item as {isSignatureDish?: boolean}).isSignatureDish ?? false : false,
              sortOrder: cat.items.indexOf(item),
            },
          });
        }
      }
    }
  }

  console.log("✅ Seeding complete!");
  console.log(`   ${restaurants.length} restaurants seeded`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
