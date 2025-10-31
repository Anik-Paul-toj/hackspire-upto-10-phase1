export const cloudinaryConfig = {
  cloudName: 'dapalnm6r',
  apiKey: '463174385936929',
  apiSecret: 'Ueq99NIXDLchPR_v16HDYqHauCY',
};

export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;

/**
 * Simple image upload to Cloudinary (unsigned preset)
 * - If given an https URL, sends the URL directly
 * - If given a local file URI, converts to Blob first
 * Returns Cloudinary secure_url or the original URI as a fallback
 */
export async function uploadImageSimple(imageUri: string, uploadPreset: string = 'ml_default'): Promise<string> {
  try {
    const formData = new FormData();
    const isRemote = /^https?:\/\//i.test(imageUri);

    if (isRemote) {
      formData.append('file', imageUri);
    } else {
      const res = await fetch(imageUri);
      const blob = await res.blob();
      const filename = `profile_${Date.now()}.jpg`;
      formData.append('file', blob, filename);
    }

    formData.append('upload_preset', uploadPreset);

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (data?.secure_url) return data.secure_url as string;
    console.log('Cloudinary upload failed:', data?.error?.message || 'unknown error');
    return imageUri;
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    return imageUri;
  }
}


