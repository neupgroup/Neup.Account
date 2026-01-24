
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function SwitchPage() {
    const cookieStore = await cookies();

    // Since the cookie is HttpOnly, we must check it server-side.
    if (cookieStore.has('auth_managing')) {
        // If managing, redirect to the switchback route which handles clearing the cookie
        redirect("/auth/switchback");
    } else {
        // If not managing, go to the brand selection page
        redirect("/manage/brand");
    }
}
