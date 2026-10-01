const fs = require("fs");
const code = fs.readFileSync("server.js", "utf8");
const checks = [
  'app.get("/health"',
  'app.get("/employees"',
  'app.post("/employees"',
  "CREATE TABLE IF NOT EXISTS employees"
];
for (const check of checks) {
  if (!code.includes(check)) {
    console.error(`Test failed: missing ${check}`);
    process.exit(1);
  }
}
console.log("All application structure tests passed.");
