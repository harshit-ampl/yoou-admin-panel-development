import { NextRequest } from "next/server";
import { MetalPrice } from "@/models";

export const dynamic = "force-dynamic";

/**
 * Convert purity description to Karat
 */
function getKarat(purity: string) {
  const map: Record<string, string> = {
    "99.50": "24",
    "92": "22",
    "18K": "18",
    "14K": "14",
    "37.50": "9",
  };

  return map[purity] || purity;
}

export async function GET(req: NextRequest) {
  try {
    const lang = req.nextUrl.searchParams.get("lang") || "en";

    const metals = await MetalPrice.findAll();

    if (!metals || metals.length === 0) {
      return new Response(
        "We are unable to fetch metal prices at the moment. Please try again later.",
        {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
    }

    let message = "";

    /** Intro text */
    if (lang === "hi") {
      message = "Aaj ke dhatu ke bhaav is prakar hain. ";
    } else if (lang === "mr") {
      message = "Aajche dhatuche dar pudhilpramane aahet. ";
    } else {
      message = "Today's metal rates are as follows. ";
    }

    metals.forEach((metal) => {
      const rate = Number(metal.sale_rate).toLocaleString("en-IN");
      const purity = metal.purity_description;

      /** GOLD */
      if (metal.metal_type === "gold") {
        const karat = getKarat(purity);

        if (lang === "hi") {
          message += `${karat} carat sone ka bhaav ${rate} rupaye prati 1 gram hai. `;
        } else if (lang === "mr") {
          message += `${karat} carat sonyacha dar ${rate} rupaye prati 1 gram aahe. `;
        } else {
          message += `${karat} karat gold rate is ${rate} rupees per 1 grams. `;
        }
      }

      /** SILVER */
      if (metal.metal_type === "silver") {
        if (lang === "hi") {
          message += `Chandi ka bhaav ${rate} rupaye prati 1 gram hai. `;
        } else if (lang === "mr") {
          message += `Chandicha dar ${rate} rupaye prati 1 gram aahe. `;
        } else {
          message += `Silver rate is ${rate} rupees per 1 gram. `;
        }
      }

      /** PLATINUM */
      if (metal.metal_type === "platinum") {
        if (lang === "hi") {
          message += `Platinum ka bhaav ${rate} rupaye prati 1 gram hai. `;
        } else if (lang === "mr") {
          message += `Platinum cha dar ${rate} rupaye prati 1 gram aahe. `;
        } else {
          message += `Platinum rate is ${rate} rupees per 1 gram. `;
        }
      }
    });

    /** Ending text */
    if (lang === "hi") {
      message += "PNG Jewellers ko call karne ke liye dhanyavaad.";
    } else if (lang === "mr") {
      message += "PNG Jewellers la call kelyabaddal dhanyavaad.";
    } else {
      message += "Thank you for calling PNG Jewellers.";
    }

    return new Response(message, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

  } catch (error) {
    return new Response(
      "We are unable to fetch metal prices at the moment. Please try again later.",
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

/**
 * Exotel requires HEAD support
 */
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
