import { Button } from "@radix-ui/themes";
import { useRef, useState } from "react";
import { SERVER_URL } from "../util";

export function UploadButton(props: { onUploaded: (url: string) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState("");
    const [loading, setLoading] = useState(false);

    async function uploadFile(file: File) {
        var data = new FormData();
        data.append("file", file);

        const res = await fetch(SERVER_URL + "/api/upload", {
            method: "POST",
            body: data,
        });

        if (res.ok) {
            const resp = await res.json();
            console.log("File is uploaded");
            props.onUploaded(resp.url);
            setFileName(file.name);
        } else {
            console.error("Could not upload");
            setFileName("");
        }
    }

    return (
        <>
            <input
                hidden
                type="file"
                ref={inputRef}
                onChange={async (ev) => {
                    if ((ev.target.files?.length ?? 0) <= 0) return;

                    setLoading(true);
                    try {
                        const file = ev.target.files![0];
                        await uploadFile(file);
                    } finally {
                        setLoading(false);
                    }
                }}
            />
            <Button loading={loading} onClick={() => inputRef.current?.click()}>
                {fileName || "Select file"}
            </Button>
        </>
    );
}
