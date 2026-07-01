
import { FileUploadManager } from "@/components/file-upload-manager";
import {Metadata} from "next";

export const metadata: Metadata = {
    title: "File Upload Log",
    description: "Manage file upload log details",
};

export default function FileUploadPage() {
    return (
        <div className="flex-col">
            <div className="border-b">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-2xl font-bold">File Upload Logs</h1>
                </div>
            </div>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <FileUploadManager />
            </div>
        </div>
    );
}
