import { supabase } from "./index";

async function test() {
  const { data, error } = await supabase.from("lenders").select("*").limit(1);
  if (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
  console.log("✅ Connected! Sample row:", data);
  process.exit(0);
}

test();
