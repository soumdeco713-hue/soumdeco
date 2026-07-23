"use client";

import { useEffect, useState } from "react";

export type Wilaya = {
  code: string;
  name: string;
  ar_name: string;
};

export type Commune = {
  id: string;
  name: string;
  ar_name: string;
  wilaya_id: string;
  post_code: string;
};

const PHONE_REGEX = /^0[567]\d{8}$/;

export function useAlgeriaData() {
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetch("/data/wilayas.json"), fetch("/data/communes.json")])
      .then(async ([wRes, cRes]) => {
        const wData = (await wRes.json()) as Wilaya[];
        const cData = (await cRes.json()) as Commune[];
        if (!mounted) return;
        // Sort wilayas by code numerically
        const sorted = [...wData].sort(
          (a, b) => parseInt(a.code, 10) - parseInt(b.code, 10),
        );
        setWilayas(sorted);
        setCommunes(cData);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const getCommunesForWilaya = (wilayaCode: string): Commune[] => {
    return communes.filter((c) => c.wilaya_id === wilayaCode);
  };

  const validatePhone = (phone: string): boolean => {
    return PHONE_REGEX.test(phone.trim());
  };

  return { wilayas, communes, loading, getCommunesForWilaya, validatePhone };
}

export { PHONE_REGEX };
