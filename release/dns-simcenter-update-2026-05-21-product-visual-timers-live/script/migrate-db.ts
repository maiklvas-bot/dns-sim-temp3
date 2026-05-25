import "../server/load-env";
import { sqlite } from "../server/db";
import { runMigrations } from "../server/migrations";

runMigrations(sqlite);
console.log("Database migrations applied.");
