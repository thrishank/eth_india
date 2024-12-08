import axios from "axios";
import FormData from "form-data";
import fs from "fs";

const API_BASE_URL = 'http://localhost:8000';

export async function apiRequest(method: string, endpoint: string, data: any = null) {
    try {
      const response = await axios({
        method,
        url: `${API_BASE_URL}${endpoint}`,
        data,
      });
      console.log(`API Response for ${method} ${endpoint}:`, response.data); // Debug log
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      console.error(`API Error: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }
  
// Example to fetch and display data from the API
const fetchData = async () => {
  try {
    const buckets = await apiRequest('GET', '/buckets');
    console.log("Buckets:", buckets);

    const bucketDetails = await apiRequest('GET', `/buckets/user_history`);
    console.log("Bucket Details:", bucketDetails);

    const files = await apiRequest('GET', '/buckets/user_history/files');
    console.log("Files in Bucket:", files);

    const chatData = await apiRequest('GET', '/buckets/user_history/files/chat_data.json');
    console.log("Chat Data:", chatData);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// Function to upload a file to a specific bucket
export async function uploadFile(bucketName: string, filePath: string) {
  const fileStats = fs.statSync(filePath);
  const minFileSize = 127; // in bytes
  const maxFileSize = 100 * 1024 * 1024; // 100 MB

  if (fileStats.size < minFileSize || fileStats.size > maxFileSize) {
    console.error("File size out of allowed range (127 bytes to 100 MB).");
    return;
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  try {
    const response = await axios.post(`${API_BASE_URL}/buckets/${bucketName}/files`, form, {
      headers: form.getHeaders(),
    });
    console.log("File Uploaded Successfully:", response.data);
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message;
    console.error(`File Upload Error: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}
