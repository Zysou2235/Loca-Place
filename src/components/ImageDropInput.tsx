"use client";

import { useRef, useState } from "react";

/**
 * Champ d'image par glisser-déposer (ou clic). L'image est redimensionnée et
 * compressée côté navigateur, puis stockée en data URL dans un input caché
 * (`name="photoUrl"`) — aucun service externe requis.
 */
export function ImageDropInput({
  name = "photoUrl",
  defaultValue = "",
  maxSize = 800,
}: {
  name?: string;
  defaultValue?: string | null;
  maxSize?: number;
}) {
  const [preview, setPreview] = useState<string>(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Ce fichier n'est pas une image.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeImage(file, maxSize);
      setPreview(dataUrl);
    } catch {
      setError("Impossible de lire cette image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <input type="hidden" name={name} value={preview} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-4 py-4 text-sm transition ${
          dragOver
            ? "border-accent bg-accent/5"
            : "border-black/15 hover:border-accent/60"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Aperçu"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-black/5 text-2xl">
            🖼️
          </div>
        )}
        <div className="min-w-0">
          <div className="font-medium text-brand">
            {busy
              ? "Traitement…"
              : preview
                ? "Image ajoutée — cliquez pour changer"
                : "Glissez une image ici"}
          </div>
          <div className="text-brand/50">ou cliquez pour parcourir (JPG, PNG…)</div>
          {error && <div className="mt-1 text-red-600">{error}</div>}
        </div>
        {preview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreview("");
            }}
            className="ml-auto shrink-0 rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-brand/60 hover:bg-black/5"
          >
            Retirer
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

/** Redimensionne (côté client) une image en JPEG data URL, max `max` px de côté. */
function resizeImage(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) {
          const ratio = Math.min(max / width, max / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ctx"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
