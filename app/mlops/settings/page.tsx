import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ org?: string }>;
};

export default async function MlopsSettingsIndex({ searchParams }: PageProps) {
  const params = await searchParams;
  const orgQuery = params.org ? `?org=${encodeURIComponent(params.org)}` : "";

  redirect(`/mlops/settings/billing${orgQuery}`);
}
