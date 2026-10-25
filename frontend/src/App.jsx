// src/App.jsx
import React, { useState } from "react";
import XmlCreator from "./pages/XmlCreator";
import GooeyNav from "./components/GooeyNav";
import Tags from "./pages/Tags";
import "./index.css";

function App() {
  const [active, setActive] = useState(0);
  const items = [
    { label: "Match", href: "#" },
    { label: "Tags", href: "#" },
    { label: "Contact", href: "#" },
  ];

  return (
    <div className="h-screen bg-white-500 flex flex-col">
      <header className="flex h-auto bg-[#315047] bg-opacity-30 p-3 relative overflow-hidden rounded-lg justify-center ">
        <GooeyNav
          items={items}
          particleCount={25}
          particleDistances={[90, 10]}
          particleR={100}
          initialActiveIndex={active}
          animationTime={300}
          timeVariance={300}
          colors={[1, 2, 3, 1, 2, 3, 1, 4]}
          onChange={(index) => setActive(index)}
        />
      </header>

      <main className="flex-1 overflow-auto p-4">
        {/* Pages stay mounted so switching tabs never resets a running match */}
        <div hidden={active !== 0}><XmlCreator /></div>
        <div hidden={active !== 1}><Tags /></div>
        {active === 2 && (
          <div className="max-w-2xl mx-auto bg-white/10 rounded-3xl shadow-xl p-6 border border-white/10 text-white">email: cagataykasar@gmail.com</div>
        )}
      </main>
    </div>
  );
}

export default App;