
import { KJUR } from 'jsrsasign';

// Configuration
const DRIVE_CONFIG = {
    serviceAccountJson: import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY || '',
    parentFolderId: import.meta.env.VITE_GOOGLE_DRIVE_PARENT_FOLDER_ID || '',
};

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Check if Drive is configured
 */
export function isDriveConfigured(): boolean {
    return Boolean(DRIVE_CONFIG.serviceAccountJson && DRIVE_CONFIG.parentFolderId);
}

/**
 * Generate Access Token (Scoped for Drive)
 * Note: Scopes are different from Sheets
 */
async function getDriveToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        let credentials;
        try {
            credentials = JSON.parse(DRIVE_CONFIG.serviceAccountJson);
        } catch (e) {
            console.error('Drive Service: Failed to parse service account JSON');
            throw new Error('Invalid Configuration');
        }

        const now = Math.floor(Date.now() / 1000);
        const header = { alg: 'RS256', typ: 'JWT' };
        const payload = {
            iss: credentials.client_email,
            scope: 'https://www.googleapis.com/auth/drive.file', // Access only files created by this app (safer) or drive.file
            // Actually, to see folders created by user, we might need full drive scope or 
            // relies on the folder being shared with the service account.
            // 'https://www.googleapis.com/auth/drive' is full access. 
            // 'https://www.googleapis.com/auth/drive.file' is cleaner if we only touch our own files.
            // BUT: We need to see the PARENT folder shared by the user. 'drive.file' usually allows seeing files/folders 
            // that are shared with the service account.
            aud: TOKEN_ENDPOINT,
            exp: now + 3600,
            iat: now,
        };

        const signedJWT = KJUR.jws.JWS.sign(
            'RS256',
            JSON.stringify(header),
            JSON.stringify(payload),
            credentials.private_key
        );

        const response = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: signedJWT,
            }),
        });

        if (!response.ok) {
            throw new Error(`Auth failed: ${response.status}`);
        }

        const data = await response.json();
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

        return cachedToken!;
    } catch (error) {
        console.error('Drive Service: Auth Error:', error);
        throw error;
    }
}

/**
 * Find a folder by name within a parent folder
 */
async function findFolder(name: string, parentId: string): Promise<string | null> {
    try {
        const token = await getDriveToken();
        const query = `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Search failed: ${response.status}`);

        const data = await response.json();
        if (data.files && data.files.length > 0) {
            return data.files[0].id;
        }
        return null;
    } catch (error) {
        console.error('Drive Service: Search Error:', error);
        return null;
    }
}

/**
 * Create a new folder
 */
async function createFolder(name: string, parentId: string): Promise<string> {
    try {
        const token = await getDriveToken();
        const metadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        };

        const response = await fetch(`${DRIVE_API_BASE}/files`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) throw new Error(`Create folder failed: ${response.status}`);

        const data = await response.json();
        return data.id;
    } catch (error) {
        console.error('Drive Service: Create Folder Error:', error);
        throw error;
    }
}

/**
 * Find or create a specific folder structure
 */
export async function ensureAccountFolder(accountName: string): Promise<string> {
    if (!isDriveConfigured()) throw new Error('Drive not configured');

    const parentId = DRIVE_CONFIG.parentFolderId;

    // Check if account folder exists
    let folderId = await findFolder(accountName, parentId);

    if (!folderId) {
        try {
            const credentials = JSON.parse(DRIVE_CONFIG.serviceAccountJson);
            console.log(`Drive Service: Creating folder '${accountName}' in parent '${parentId}' using ${credentials.client_email}...`);
        } catch (e) { /* ignore */ }

        folderId = await createFolder(accountName, parentId);
    }

    return folderId;
}

/**
 * Upload a file to a specific folder
 */
export async function uploadFileToDrive(file: File, folderId: string): Promise<{ id: string; webViewLink: string }> {
    if (!isDriveConfigured()) throw new Error('Drive not configured');

    try {
        const token = await getDriveToken();

        const metadata = {
            name: file.name,
            parents: [folderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const url = `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,webViewLink`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Upload failed: ${response.status} ${errText}`);
        }

        const data = await response.json();
        console.log('Drive Service: Upload success', data);
        return { id: data.id, webViewLink: data.webViewLink }; // Return object
    } catch (error) {
        console.error('Drive Service: Upload Error:', error);
        throw error;
    }
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string): Promise<boolean> {
    if (!isDriveConfigured()) return false;

    try {
        const token = await getDriveToken();
        const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
        return true;
    } catch (error) {
        console.error('Drive Service: Delete File Error:', error);
        return false;
    }
}
