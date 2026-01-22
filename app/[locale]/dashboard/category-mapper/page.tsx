import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CategoryMapperClient } from "./category-mapper-client";

export default async function CategoryMapperPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return <CategoryMapperClient />;
}
