import { useState, useEffect } from "react";

const CACHE_KEY = "findream_exchange_rates_v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

interface Rates {
  CLP: number; // cuantos CLP es 1 USD
  COP: number; // cuantos COP es 1 USD
  timestamp: number;
}

export const useExchangeRate = () => {
  const [rates, setRates] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as Rates;
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        setRates(parsed);
        return;
      }
    }
    setLoading(true);
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then(data => {
        const newRates: Rates = {
          CLP: data.rates.CLP || 950,
          COP: data.rates.COP || 4000,
          timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(newRates));
        setRates(newRates);
      })
      .catch(() => {
        // fallback a valores razonables
        setRates({ CLP: 950, COP: 4000, timestamp: Date.now() });
      })
      .finally(() => setLoading(false));
  }, []);

  // Convierte un monto desde su moneda a la moneda objetivo
  const convertir = (monto: number, desde: string, hacia: string): number => {
    if (!rates || desde === hacia) return monto;
    // Primero convertir a USD
    let usd = monto;
    if (desde === "CLP") usd = monto / rates.CLP;
    else if (desde === "COP") usd = monto / rates.COP;

    // Luego de USD a la moneda destino
    if (hacia === "USD") return Math.round(usd * 100) / 100;
    if (hacia === "CLP") return Math.round(usd * rates.CLP);
    if (hacia === "COP") return Math.round(usd * rates.COP);
    return monto;
  };

  return { rates, loading, convertir };
};
