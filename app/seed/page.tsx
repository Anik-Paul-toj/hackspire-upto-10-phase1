"use client";
import { useState } from "react";
import { doc, setDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useFirebaseUser } from "@/hooks/useFirebaseUser";

export default function SeedPage() {
  const { db } = getFirebase();
  const { user } = useFirebaseUser();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const seed = async () => {
    setStatus("Seeding...");
    setError("");
    try {
      if (!user) throw new Error("Sign in first");

      // 1) Ensure current user is admin (for ai_analysis and system_logs writes)
      await setDoc(
        doc(db, "users", user.uid),
        {
          name: user.displayName ?? "",
          email: user.email ?? "",
          role: "admin",
          photoURL: user.photoURL ?? "",
          verified: true,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );

      // 2) locations/{uid}
      await setDoc(
        doc(db, "locations", user.uid),
        {
          latestLocation: { lat: 19.076, lng: 72.8777, timestamp: serverTimestamp(), source: "mobile" },
          history: [
            { lat: 19.0759, lng: 72.8776, timestamp: new Date(), source: "mobile" },
          ],
        },
        { merge: true }
      );

      // 3) alerts/{auto}
      await addDoc(collection(db, "alerts"), {
        userID: user.uid,
        userName: user.displayName ?? "",
        message: "Test SOS from seed",
        location: { lat: 19.0762, lng: 72.8781 },
        imageURL: "",
        status: "pending",
        blockchainTX: "",
        verifiedByAI: false,
        timestamp: serverTimestamp(),
        aiSummary: "",
      });

      // 4) ai_analysis/{areaID}
      await setDoc(doc(db, "ai_analysis", "demo_area_1"), {
        areaName: "Demo Area 1",
        dangerScore: 42,
        summary: "Low-to-moderate risk based on recent activity.",
        sentiment: "neutral",
        lastUpdated: serverTimestamp(),
      });

      // 5) system_logs/{logId}
      await setDoc(doc(db, "system_logs", `log_${Date.now()}`), {
        type: "IOT_UPDATE",
        refID: user.uid,
        description: "Seeded initial data",
        timestamp: serverTimestamp(),
        status: "success",
      });

      // 6) mesh_network/{roomID}
      await setDoc(doc(db, "mesh_network", "room_seed_1"), {
        participants: [user.uid],
        messages: [
          { sender: user.uid, message: "Seed hello", timestamp: new Date() },
        ],
        active: true,
        createdAt: serverTimestamp(),
      });

      setStatus("Seeded successfully. Check Firestore.");
    } catch (e: any) {
      setError(e?.message ?? "Seeding failed");
      setStatus("");
    }
  };

  return (
    <main className="max-w-xl mx-auto py-10 px-6">
      <h1 className="text-2xl font-semibold mb-4">Seed Firestore</h1>
      <p className="text-sm text-gray-600 mb-6">Sign in, then click to insert one sample document per collection.</p>
      <button
        onClick={seed}
        className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
      >
        Seed now
      </button>
      {status && <p className="mt-4 text-green-700">{status}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </main>
  );
}


