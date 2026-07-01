import { UserInformationManager } from "@/components/user-information-manager";
import {Metadata} from "next";

export const metadata: Metadata = {
    title: "User Information",
    description: "Manage user information and details",
};

export default function UserInformationPage() {
    return (
        <div className="flex-col">
            <div className="border-b">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-2xl font-bold">Access Control Management</h1>
                </div>
            </div>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <UserInformationManager />
            </div>
        </div>
    );
}
