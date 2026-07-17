"use client";
import dynamic from "next/dynamic";

const Home = dynamic(() => import("./_home"), { ssr: false });
export default Home;
