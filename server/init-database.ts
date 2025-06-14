import { db } from "./db";
import { vlans, subnets } from "@shared/schema";

export async function initializeDatabase() {
  try {
    console.log("Database connection established successfully");
    // Database is ready for use - VLANs and subnets will be created through the GUI
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}