"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Pencil,
  Trash2,
  Plus,
  Lock,
  Upload,
  X,
  Save,
  Image as ImageIcon,
  Eye,
  Star,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Product,
  ProductVariant,
  QuantityTier,
  formatPrice,
  getProductImages,
} from "@/lib/products";
import { BRAND } from "@/lib/brand-config";

const ADMIN_PASSWORD = BRAND.adminPassword;
const SESSION_KEY = BRAND.storage.adminAuth;

type AdminPanelProps = {
  products: Product[];
  onUpsert: (product: Product) => void;
  onDelete: (id: string) => void;
  onAddBlank: () => Product;
  onMove: (id: string, direction: "up" | "down") => void;
  onReset: () => void;
  onClose: () => void;
};

// Resize image to high quality for Cloudinary.
// Settings:
//   - maxSize: 1500px (balanced quality + storage)
//   - quality: 0.93 (high quality JPEG)
//   - Max 5 photos per product
//   - PNG transparency preserved when source is PNG
//   - Fallback budget: if Cloudinary is NOT configured, progressively
//     reduce quality until ~400KB to fit in base64.
async function resizeImage(
  file: File,
  maxSize = 1500,
  budget = 400_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        // Only downscale if the image exceeds maxSize; never upscale.
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas not supported"));
          return;
        }
        // Maximum-quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Preserve PNG transparency; otherwise use JPEG at max quality.
        const isPng = file.type === "image/png";
        const isWebp = file.type === "image/webp";
        let quality = 0.93;
        let mimeType = isPng ? "image/png" : "image/jpeg";
        let dataUrl = canvas.toDataURL(mimeType, quality);

        // Fallback: if Cloudinary is NOT configured, the base64 goes
        // directly to the sheet. Progressively reduce quality until it
        // fits within the budget. PNG has no quality param → fall back to JPEG.
        if (dataUrl.length > budget) {
          mimeType = "image/jpeg";
          quality = 0.95;
          dataUrl = canvas.toDataURL(mimeType, quality);
          while (dataUrl.length > budget && quality > 0.55) {
            quality -= 0.05;
            dataUrl = canvas.toDataURL(mimeType, quality);
          }
          // If still too large, reduce resolution
          while (dataUrl.length > budget && width > 800) {
            width = Math.round(width * 0.85);
            height = Math.round(height * 0.85);
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            dataUrl = canvas.toDataURL(mimeType, quality);
          }
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

function PasswordGate({ onAuthed }: { onAuthed: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (value === ADMIN_PASSWORD) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // ignore
      }
      onAuthed();
    } else {
      setError(true);
    }
  };

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center p-6"
      dir="rtl"
      lang="ar"
    >
      <div className="w-full max-w-sm rounded-2xl border border-emerald/30 bg-night-soft/80 p-6 shadow-2xl backdrop-blur-md">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald/10">
            <Lock className="h-6 w-6 text-emerald" />
          </div>
          <h2 className="font-arabic text-2xl font-bold text-charcoal">
            لوحة التحكم
          </h2>
          <p className="mt-1 font-arabic text-sm text-gray">
            أدخل كلمة المرور للوصول إلى لوحة إدارة المنتجات.
          </p>
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className={`w-full rounded-lg border bg-night/60 px-3 py-2.5 text-right font-arabic text-sm text-charcoal outline-none focus:border-emerald ${
            error ? "border-terracotta" : "border-clay/40"
          }`}
          placeholder="كلمة المرور"
          autoFocus
        />
        {error && (
          <p className="mt-2 font-arabic text-xs text-terracotta">
            كلمة المرور غير صحيحة.
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          className="mt-4 w-full rounded-full bg-emerald px-4 py-2.5 text-sm font-semibold text-night hover:bg-emerald-bright"
          style={{ boxShadow: "0 0 18px rgba(42, 125, 91, 0.45)" }}
        >
          دخول
        </button>
      </div>
    </div>
  );
}

function EditForm({
  product,
  categories,
  onSave,
  onCancel,
}: {
  product: Product;
  categories: string[];
  onSave: (p: Product) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Product>(product);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(product);
  }, [product]);

  const photos = getProductImages(draft);
  // Allow up to 5 high-quality photos per product.
  const MAX_PHOTOS = 5;

  const syncPhotos = (next: string[]) => {
    const cleaned = next.filter((s) => s && s.trim() !== "");
    setDraft((d) => ({
      ...d,
      images: cleaned,
      image: cleaned[0] ?? "",
    }));
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) {
      toast.error("الرجاء اختيار ملف صورة.");
      return;
    }
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(`الحد الأقصى ${MAX_PHOTOS} صور لكل منتج.`);
      return;
    }
    const toProcess = arr.slice(0, remaining);
    if (arr.length > remaining) {
      toast.message(`سيتم إضافة أول ${remaining} صور فقط.`);
    }
    setUploading(true);
    try {
      const newPhotos: string[] = [];
      for (const f of toProcess) {
        try {
          const dataUrl = await resizeImage(f, 1500, 400_000);
          newPhotos.push(dataUrl);
        } catch {
          // skip failed image
        }
      }
      if (newPhotos.length === 0) {
        toast.error("فشل في معالجة الصور.");
        return;
      }
      syncPhotos([...photos, ...newPhotos]);
      toast.success(
        `تمت إضافة ${newPhotos.length} صورة${newPhotos.length > 1 ? " بنجاح" : " بنجاح"}.`,
      );
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFiles(files);
  };

  const removePhoto = (idx: number) => {
    const next = [...photos];
    next.splice(idx, 1);
    syncPhotos(next);
  };

  const setCoverPhoto = (idx: number) => {
    if (idx === 0 || idx >= photos.length) return;
    const next = [...photos];
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    syncPhotos(next);
  };

  // Variants management — simple Colors + Sizes sections (replaces the old
  // generic "variations" editor). Each entry has a name + optional price
  // adjustment. Both lists live on the same `draft.variants` array, tagged
  // with `type: "color" | "size"`. The two sections are rendered by filtering
  // the same array; the GLOBAL array index is passed to each handler so the
  // state update maps over the right entry.
  const variants: ProductVariant[] = draft.variants ?? [];

  const addVariant = (type: "color" | "size") => {
    setDraft((d) => ({
      ...d,
      variants: [...(d.variants ?? []), { type, name: "", priceAdjustment: 0 }],
    }));
  };
  const removeVariant = (idx: number) => {
    setDraft((d) => ({
      ...d,
      variants: (d.variants ?? []).filter((_, i) => i !== idx),
    }));
  };
  const updateVariantName = (idx: number, name: string) => {
    setDraft((d) => ({
      ...d,
      variants: (d.variants ?? []).map((v, i) =>
        i === idx ? { ...v, name } : v,
      ),
    }));
  };
  const updateVariantAdjustment = (idx: number, adj: number) => {
    setDraft((d) => ({
      ...d,
      variants: (d.variants ?? []).map((v, i) =>
        i === idx ? { ...v, priceAdjustment: isNaN(adj) ? 0 : adj } : v,
      ),
    }));
  };

  // Quantity tiers management — special offers at specific quantities.
  // Each tier can combine a free-shipping benefit AND a discount amount.
  const tiers = draft.quantityTiers ?? [];

  const addTier = () => {
    const newTiers: QuantityTier[] = [
      ...tiers,
      { qty: 2, freeShipping: "both" },
    ];
    setDraft({ ...draft, quantityTiers: newTiers });
  };

  const removeTier = (idx: number) => {
    const newTiers = tiers.filter((_, i) => i !== idx);
    setDraft({ ...draft, quantityTiers: newTiers });
  };

  const updateTier = (
    idx: number,
    field: keyof QuantityTier,
    value: number | QuantityTier["freeShipping"],
  ) => {
    const newTiers = [...tiers];
    const prev = newTiers[idx];
    if (field === "qty") {
      newTiers[idx] = { ...prev, qty: Number(value) };
    } else if (field === "freeShipping") {
      newTiers[idx] = {
        ...prev,
        freeShipping: value as QuantityTier["freeShipping"],
      };
    } else if (field === "discountAmount") {
      const n = Number(value);
      newTiers[idx] = {
        ...prev,
        discountAmount: n > 0 ? n : undefined,
      };
    }
    setDraft({ ...draft, quantityTiers: newTiers });
  };

  const save = () => {
    const nameStr = String(draft.name ?? "").trim();
    if (!nameStr) {
      toast.error("الاسم مطلوب.");
      return;
    }
    onSave(draft);
  };

  const inputClass =
    "w-full rounded-lg border border-clay/40 bg-night/60 px-3 py-2.5 text-right font-arabic text-sm text-charcoal outline-none focus:border-brass focus:ring-1 focus:ring-brass/30";

  return (
    <div
      className="rounded-2xl border border-emerald/25 bg-night-soft/70 p-5 backdrop-blur-md sm:p-6"
      dir="rtl"
      lang="ar"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-arabic text-xl font-bold text-charcoal">
          {product.name ? "تعديل المنتج" : "منتج جديد"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="إلغاء"
          className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal hover:bg-emerald/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5 font-arabic">
        {/* 1. Multi-photo upload */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-charcoal">
              الصور{" "}
              <span className="text-xs font-normal text-gray-light">
                (الأولى = الغلاف · الحد الأقصى {MAX_PHOTOS})
              </span>
            </label>
            <span
              className={`text-[11px] font-medium ${
                photos.length >= MAX_PHOTOS ? "text-terracotta" : "text-gray-light"
              }`}
            >
              {photos.length} / {MAX_PHOTOS}
            </span>
          </div>

          {/* Existing photos grid */}
          {photos.length > 0 && (
            <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <div
                  key={i}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-clay/40 bg-night"
                >
                  <img
                    src={p}
                    alt={`صورة ${i + 1}`}
                    className="h-full w-full object-contain"
                  />
                  {i === 0 && (
                    <span className="absolute right-1 top-1 rounded-full bg-brass/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      الغلاف
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-ink/60 opacity-0 transition-opacity group-hover:opacity-100">
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => setCoverPhoto(i)}
                        aria-label="تعيين كغلاف"
                        title="تعيين كغلاف"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-night/90 text-emerald hover:bg-night-soft border border-emerald/30"
                      >
                        <Star className="h-3.5 w-3.5" fill="currentColor" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label="حذف هذه الصورة"
                      title="حذف"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-night/90 text-terracotta hover:bg-night-soft border border-terracotta/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={(e) => {
              if (uploading) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { if (!uploading) onDrop(e); }}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
              uploading
                ? "border-clay/40 bg-night/20 cursor-wait pointer-events-none"
                : "cursor-pointer " + (dragOver
                  ? "border-emerald bg-emerald/5"
                  : "border-clay/40 bg-night/30 hover:border-emerald/50")
            }`}
          >
            <div className="flex h-12 w-12 flex-col items-center justify-center text-gray-light">
              {uploading ? (
                <span className="text-xs text-emerald">جاري المعالجة...</span>
              ) : (
                <ImageIcon className="h-6 w-6" />
              )}
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald">
              <Upload className="h-3.5 w-3.5" />
              {uploading
                ? "جاري المعالجة..."
                : photos.length === 0
                  ? "إضافة صور"
                  : "إضافة المزيد من الصور"}
            </span>
            <span className="text-[10px] text-gray-light">
              انقر أو اسحب وأفلت الصور هنا
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
              }
              e.target.value = "";
            }}
          />
        </div>

        {/* ===== Section: المعلومات الأساسية ===== */}
        <h4 className="admin-section-title">المعلومات الأساسية</h4>

        {/* 2. Name */}
        <div>
          <label htmlFor={`fld-name-${draft.id ?? "new"}`} className="mb-1 block text-sm font-medium text-charcoal">
            الاسم <span className="text-terracotta">*</span>
          </label>
          <input
            id={`fld-name-${draft.id ?? "new"}`}
            name="productName"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className={inputClass}
            placeholder="اسم المنتج"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* 3. Description */}
        <div>
          <label htmlFor={`fld-desc-${draft.id ?? "new"}`} className="mb-1 block text-sm font-medium text-charcoal">
            الوصف
          </label>
          <textarea
            id={`fld-desc-${draft.id ?? "new"}`}
            name="productDescription"
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            rows={5}
            className={`${inputClass} resize-none`}
            placeholder="وصف المنتج بالعربية..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* 4. Category */}
        <div>
          <label htmlFor={`fld-category-${draft.id ?? "new"}`} className="mb-1 block text-sm font-medium text-charcoal">
            الفئة{" "}
            <span className="text-xs font-normal text-gray-light">
              (اختياري)
            </span>
          </label>
          <input
            id={`fld-category-${draft.id ?? "new"}`}
            name="productCategory"
            type="text"
            value={draft.category}
            onChange={(e) =>
              setDraft({ ...draft, category: e.target.value })
            }
            className={inputClass}
            placeholder="مثال: إكسسوارات السيارة"
            list="rokn-category-list"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <datalist id="rokn-category-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* 5. Price */}
        <div>
          <label htmlFor={`fld-price-${draft.id ?? "new"}`} className="mb-1 block text-sm font-medium text-charcoal">
            السعر{" "}
            <span className="text-xs font-normal text-gray-light">
              (فارغ = السعر عند الطلب)
            </span>
          </label>
          <input
            id={`fld-price-${draft.id ?? "new"}`}
            name="productPrice"
            type="number"
            value={draft.price ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                price:
                  e.target.value === ""
                    ? null
                    : Number(e.target.value),
              })
            }
            className={inputClass}
            placeholder="2500"
            min={0}
            autoComplete="off"
          />
        </div>

        {/* 6b. Old Price (optional — shown struck through) */}
        <div>
          <label htmlFor={`fld-oldprice-${draft.id ?? "new"}`} className="mb-1 block text-sm font-medium text-charcoal">
            السعر القديم{" "}
            <span className="text-xs font-normal text-gray-light">
              (اختياري — يظهر مشطوب)
            </span>
          </label>
          <input
            id={`fld-oldprice-${draft.id ?? "new"}`}
            name="productOldPrice"
            type="number"
            value={draft.oldPrice ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                oldPrice:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={inputClass}
            placeholder="اختياري — يُظهر بسطر مشطوب"
            min={0}
            autoComplete="off"
          />
        </div>

        {/* 7. Colors — simple list of name + optional price adjustment */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-charcoal">
              الألوان{" "}
              <span className="text-xs font-normal text-gray-light">
                (اختياري — أضف الألوان المتاحة)
              </span>
            </label>
            <button
              type="button"
              onClick={() => addVariant("color")}
              className="flex items-center gap-1 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass-deep hover:bg-brass/20"
            >
              <Plus className="h-3 w-3" />
              إضافة لون
            </button>
          </div>
          {variants.some((v) => v.type === "color") ? (
            <div className="space-y-2">
              {variants.map((v, i) => v.type === "color" && (
                <div key={`color-${i}`} className="flex gap-2">
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => updateVariantName(i, e.target.value)}
                    placeholder="مثال: أحمر"
                    className={`${inputClass} flex-1`}
                  />
                  <input
                    type="number"
                    value={v.priceAdjustment ?? 0}
                    onChange={(e) => updateVariantAdjustment(i, Number(e.target.value))}
                    placeholder="0"
                    aria-label="تعديل السعر (دج)"
                    className={`${inputClass} flex-shrink-0`}
                    style={{ width: "120px" }}
                  />
                  <span className="self-center font-arabic text-xs text-gray-light">دج</span>
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    aria-label="حذف"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-terracotta hover:bg-terracotta/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <p className="font-arabic text-[11px] text-gray-light">
                التعديل الإضافي يُضاف إلى السعر الأساسي (مثال: +100 دج للّون المميّز).
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-light">
              لا توجد ألوان. أضف الألوان إذا كان المنتج متاحاً بأكثر من لون.
            </p>
          )}
        </div>

        {/* 7b. Sizes — same structure as Colors */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-charcoal">
              المقاسات{" "}
              <span className="text-xs font-normal text-gray-light">
                (اختياري — أضف المقاسات المتاحة)
              </span>
            </label>
            <button
              type="button"
              onClick={() => addVariant("size")}
              className="flex items-center gap-1 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass-deep hover:bg-brass/20"
            >
              <Plus className="h-3 w-3" />
              إضافة مقاس
            </button>
          </div>
          {variants.some((v) => v.type === "size") ? (
            <div className="space-y-2">
              {variants.map((v, i) => v.type === "size" && (
                <div key={`size-${i}`} className="flex gap-2">
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => updateVariantName(i, e.target.value)}
                    placeholder="مثال: كبير"
                    className={`${inputClass} flex-1`}
                  />
                  <input
                    type="number"
                    value={v.priceAdjustment ?? 0}
                    onChange={(e) => updateVariantAdjustment(i, Number(e.target.value))}
                    placeholder="0"
                    aria-label="تعديل السعر (دج)"
                    className={`${inputClass} flex-shrink-0`}
                    style={{ width: "120px" }}
                  />
                  <span className="self-center font-arabic text-xs text-gray-light">دج</span>
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    aria-label="حذف"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-terracotta hover:bg-terracotta/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <p className="font-arabic text-[11px] text-gray-light">
                التعديل الإضافي يُضاف إلى السعر الأساسي (مثال: +50 دج للمقاس الكبير).
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-light">
              لا توجد مقاسات. أضف المقاسات إذا كان المنتج متاحاً بأكثر من مقاس.
            </p>
          )}
        </div>

        {/* 7d. Quantity tiers (عروض الكمية) — available for ALL products */}
        <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-charcoal">
                عروض الكمية{" "}
                <span className="text-xs font-normal text-gray-light">
                  (اختياري — عرض خاص عند شراء كمية معيّنة)
                </span>
              </label>
              <button
                type="button"
                onClick={addTier}
                className="flex items-center gap-1 rounded-full bg-neon-magenta/15 px-3 py-1 text-xs font-medium text-neon-magenta hover:bg-neon-magenta/25"
              >
                <Plus className="h-3 w-3" />
                إضافة عرض
              </button>
            </div>
            {tiers.length > 0 ? (
              <div className="space-y-2">
                {tiers.map((t, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-neon-magenta/20 bg-neon-magenta/5 p-2"
                  >
                    <select
                      value={t.qty}
                      onChange={(e) => updateTier(i, "qty", Number(e.target.value))}
                      className={`${inputClass} flex-shrink-0`}
                      style={{ width: "90px" }}
                      aria-label="الكمية"
                    >
                      <option value={1}>1 قطعة</option>
                      <option value={2}>2 قطعة</option>
                      <option value={3}>3 قطع</option>
                      <option value={4}>4 قطع</option>
                    </select>
                    <select
                      value={t.freeShipping}
                      onChange={(e) =>
                        updateTier(i, "freeShipping", e.target.value as QuantityTier["freeShipping"])
                      }
                      className={`${inputClass} flex-shrink-0`}
                      style={{ width: "140px" }}
                      aria-label="توصيل مجاني"
                    >
                      <option value="none">لا</option>
                      <option value="desk">مكتب</option>
                      <option value="home">منزل</option>
                      <option value="both">كلاهما</option>
                    </select>
                    <input
                      type="number"
                      value={t.discountAmount ?? 0}
                      onChange={(e) =>
                        updateTier(i, "discountAmount", Number(e.target.value))
                      }
                      className={`${inputClass} flex-shrink-0`}
                      style={{ width: "110px" }}
                      min={0}
                      placeholder="خصم (دج)"
                      aria-label="مبلغ الخصم (دج)"
                    />
                    <span className="font-arabic text-xs text-gray-light">دج خصم</span>
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      aria-label="حذف"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-terracotta hover:bg-terracotta/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <p className="font-arabic text-[11px] text-gray-light">
                  يمكنك الجمع بين توصيل مجاني وخصم في نفس الكمية. اترك الحقول على "لا" و0 إذا لم ترد الفائدة.
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-light">
                لا توجد عروض كمية. أضف عرضاً لمنح العميل توصيل مجاني أو خصم عند شراء كمية معيّنة.
              </p>
            )}
          </div>

        {/* ===== Section: العرض ===== */}
        <h4 className="admin-section-title">العرض</h4>

        {/* 7b. Badge */}
        <div>
          <label htmlFor={`fld-badge-${draft.id ?? "new"}`} className="mb-1 block text-sm font-medium text-charcoal">
            شارة العرض{" "}
            <span className="text-xs font-normal text-gray-light">
              (مثال: عرض خاص، جديد، تخفيض — اختياري)
            </span>
          </label>
          <input
            id={`fld-badge-${draft.id ?? "new"}`}
            name="productBadge"
            type="text"
            value={draft.badge ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, badge: e.target.value })
            }
            className={inputClass}
            placeholder="عرض خاص"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* 8. Featured */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={draft.featured}
            onChange={(e) =>
              setDraft({ ...draft, featured: e.target.checked })
            }
            className="h-4 w-4 rounded border-clay/40 accent-brass"
          />
          <span className="text-sm text-charcoal">
            عرض في المنتجات المميزة
          </span>
        </label>

        {/* 8b. Special offer — adds the product to the "عروض خاصة" section on the home page.
            When checked, reveals the quantity tiers editor above so the admin can set
            free shipping / discount tiers for this special-offer product. */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={draft.isSpecialOffer === true}
            onChange={(e) =>
              setDraft({ ...draft, isSpecialOffer: e.target.checked })
            }
            className="h-4 w-4 rounded border-clay/40 accent-rose-deep"
          />
          <span className="text-sm text-charcoal">
            عرض في قسم العروض الخاصة
          </span>
        </label>
        {draft.isSpecialOffer && (
          <p className="font-arabic text-[11px] text-neon-magenta">
            🎁 سيظهر هذا المنتج في قسم "عروض خاصة" — أضف عروض الكمية أعلاه لمنح العملاء توصيل مجاني أو خصم.
          </p>
        )}

        {/* 9. Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald px-4 py-2.5 text-sm font-semibold text-night hover:bg-emerald-bright"
            style={{ boxShadow: "0 0 18px rgba(42, 125, 91, 0.45)" }}
          >
            <Save className="h-4 w-4" />
            حفظ
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-clay/40 px-5 py-2.5 text-sm font-semibold text-charcoal hover:bg-emerald/10"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel({
  products,
  onUpsert,
  onDelete,
  onAddBlank,
  onMove,
  onClose,
}: AdminPanelProps) {
  const [authed, setAuthed] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") setAuthed(true);
    } catch {
      // ignore
    }
  }, []);

  const categories = Array.from(
    new Set(
      products
        .map((p) => (p.category || "").trim())
        .filter(Boolean),
    ),
  );

  const handleSave = (p: Product) => {
    onUpsert(p);
    setEditing(null);
    toast.success("تم حفظ المنتج");
  };

  const handleAddBlank = () => {
    const np = onAddBlank();
    setEditing(np);
  };

  const handleDelete = (p: Product) => {
    if (
      window.confirm(`حذف "${p.name || "هذا المنتج"}" ؟`)
    ) {
      onDelete(p.id);
      toast.success("تم حذف المنتج");
    }
  };

  return (
    <div
      className="min-h-screen bg-night font-arabic"
      dir="rtl"
      lang="ar"
    >
      {/* Admin header */}
      <div className="sticky top-0 z-30 border-b border-emerald/15 bg-night-soft/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-arabic text-xl font-bold text-charcoal">
              لوحة التحكم · {BRAND.name}
            </h1>
            <p className="text-xs text-gray-light">إدارة المنتجات</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-emerald/30 bg-night-soft/60 px-4 py-2 text-sm font-medium text-charcoal hover:bg-emerald/10"
          >
            خروج
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {!authed ? (
          <PasswordGate onAuthed={() => setAuthed(true)} />
        ) : editing ? (
          <EditForm
            product={editing}
            categories={categories}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray">
                {products.length} منتج{products.length > 1 ? "ات" : ""}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddBlank}
                  className="flex items-center gap-1.5 rounded-full bg-emerald px-5 py-2.5 text-base font-bold text-night hover:bg-emerald-bright"
                  style={{ boxShadow: "0 0 18px rgba(42, 125, 91, 0.45)" }}
                >
                  <Plus className="h-5 w-5" />
                  إضافة منتج
                </button>
              </div>
            </div>

            {/* Help text */}
            <p className="mb-3 text-center font-arabic text-xs text-gray-light">
              اختر منتجاً للتعديل أو اضغط لإضافة منتج جديد
            </p>

            {/* Product list — ordered by sortOrder */}
            <div className="overflow-hidden rounded-2xl border border-clay/40 bg-night-soft/70 backdrop-blur-md">
              {products.length === 0 ? (
                <p className="p-8 text-center font-arabic text-sm text-gray-light">
                  لا توجد منتجات. اضغط على «إضافة منتج».
                </p>
              ) : (
                <ul className="divide-y divide-clay/40">
                  {products.map((p, idx) => {
                    const imgs = getProductImages(p);
                    const cover = imgs[0] || "";
                    const photoCount = imgs.length;
                    const isFirst = idx === 0;
                    const isLast = idx === products.length - 1;
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 p-3"
                      >
                        {/* Position number + up/down arrows */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => onMove(p.id, "up")}
                            disabled={isFirst}
                            aria-label="تحريك للأعلى"
                            title="تحريك للأعلى"
                            className="flex h-6 w-6 items-center justify-center rounded-md text-gray transition-colors hover:bg-emerald/10 hover:text-emerald disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald/30 bg-emerald/10 font-arabic text-[10px] font-bold text-emerald">
                            {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => onMove(p.id, "down")}
                            disabled={isLast}
                            aria-label="تحريك للأسفل"
                            title="تحريك للأسفل"
                            className="flex h-6 w-6 items-center justify-center rounded-md text-gray transition-colors hover:bg-emerald/10 hover:text-emerald disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-night">
                          {cover ? (
                            <img
                              src={cover}
                              alt={p.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-gray-light" />
                            </div>
                          )}
                          {photoCount > 1 && (
                            <span className="absolute bottom-0 left-0 rounded-tr bg-ink/70 px-1 text-[9px] font-semibold text-cream">
                              {photoCount}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-arabic text-sm font-medium text-charcoal">
                            {p.name || "(بدون اسم)"}
                          </p>
                          <p className="font-arabic text-xs text-emerald">
                            {formatPrice(p.price)}
                          </p>
                          <p className="font-arabic text-xs text-gray-light">
                            {p.category || "بدون فئة"}
                            {p.featured ? " · مميّز" : ""}
                            {p.isSpecialOffer ? " · 🎁 عرض خاص" : ""}
                            {p.badge ? ` · ${p.badge}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(p)}
                            aria-label="تعديل"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-charcoal hover:bg-emerald/10"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            aria-label="حذف"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-terracotta hover:bg-terracotta/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );
}
