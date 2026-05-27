import Client from "../Models/ClientModel.js";
import cloudinary from "../Config/cloudinary.js";
import fs from "fs";

/* =========================
   Helper: Upload to Cloudinary + Remove Temp File
========================= */
const uploadToCloudinary = async (filePath, folderName) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: folderName,
  });

  // remove temp file after upload
  fs.unlinkSync(filePath);

  return result.secure_url;
};

const extractCloudinaryPublicId = (assetUrl) => {
  try {
    if (!assetUrl || typeof assetUrl !== "string") return null;
    const url = new URL(assetUrl);
    const uploadMarker = "/upload/";
    const uploadIndex = url.pathname.indexOf(uploadMarker);
    if (uploadIndex === -1) return null;

    let publicPath = url.pathname.slice(uploadIndex + uploadMarker.length);
    publicPath = publicPath.replace(/^v\d+\//, "");
    publicPath = publicPath.replace(/\.[^/.]+$/, "");

    return publicPath || null;
  } catch {
    return null;
  }
};

const deleteFromCloudinary = async (assetUrl) => {
  const publicId = extractCloudinaryPublicId(assetUrl);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("⚠️ Cloudinary delete failed:", error.message);
  }
};

/* =========================
   CREATE CLIENT
========================= */
export const createClient = async (req, res) => {
  try {
    const body = req.body;

    console.log("📥 Incoming Body:", body);
    console.log("📁 Files Received:", req.files);

    /* =========================
       REQUIRED FIELDS
    ========================= */
    const requiredFields = [
      "clientName",
      "contact",
      "gender",
      "maritalStatus",
      "nationality",
      "aadhaarCardNo",
      "panCardNo",
      "fatherName",

      "fatherPhone",
      "motherName",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} is required ❌`,
        });
      }
    }

    /* =========================
       PHOTO REQUIRED
    ========================= */
    if (!req.files?.photo?.[0]) {
      return res.status(400).json({
        success: false,
        message: "Live photo is required ❌",
      });
    }

    /* =========================
       BUILD CLIENT DATA
    ========================= */
    let clientData = {
      ...body,
      photoCapturedAt: new Date(),
      familyMembersCount: Number(body.familyMembersCount) || 0,
    };

    /* =========================
       ✅ PARALLEL UPLOADS — photo + all documents at same time
    ========================= */
    const documentsMeta =
      req.files?.documents && body.documents
        ? typeof body.documents === "string"
          ? JSON.parse(body.documents)
          : body.documents
        : [];

    // Build all upload promises together
    const photoPromise = uploadToCloudinary(
      req.files.photo[0].path,
      "FamousData/photos",
    );

    const docPromises =
      req.files?.documents?.map((docFile, i) =>
        uploadToCloudinary(docFile.path, "FamousData/documents").then(
          (url) => ({
            documentType: documentsMeta[i]?.documentType || "Other",
            imageUrl: url,
          }),
        ),
      ) || [];

    // ✅ Run photo + all docs in parallel
    const [photoUrl, ...uploadedDocs] = await Promise.all([
      photoPromise,
      ...docPromises,
    ]);

    clientData.photo = photoUrl;
    clientData.documents = uploadedDocs;

    /* =========================
       BIOMETRICS (OPTIONAL) — parallel too
    ========================= */
    clientData.biometricData = [];

    if (req.files?.biometrics && body.biometricData) {
      const biometricMeta =
        typeof body.biometricData === "string"
          ? JSON.parse(body.biometricData)
          : body.biometricData;

      const bioPromises = req.files.biometrics.map((bioFile, i) =>
        uploadToCloudinary(bioFile.path, "FamousData/biometrics").then(
          (url) => ({
            fingerType: biometricMeta[i]?.fingerType || "Unknown",
            fingerprintUrl: url,
            quality: biometricMeta[i]?.quality || 0,
          }),
        ),
      );

      clientData.biometricData = await Promise.all(bioPromises);
    }

    /* =========================
       SAVE CLIENT
    ========================= */
    const client = await Client.create(clientData);

    res.status(201).json({
      success: true,
      message: "Client registered successfully ✅",
      client,
    });
  } catch (error) {
    console.error("❌ Create Client Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   GET ALL CLIENTS
========================= */
export const getClients = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 100 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.registrationStatus = status;

    if (search) {
      query.$or = [
        { clientName: { $regex: search, $options: "i" } },
        { surname: { $regex: search, $options: "i" } },
        { contact: { $regex: search, $options: "i" } },
        { nationality: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Client.countDocuments(query);

    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      clients,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Get Clients Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   GET CLIENT BY ID
========================= */
export const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found ❌",
      });
    }

    res.status(200).json({
      success: true,
      client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   UPDATE CLIENT
========================= */
export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const existingClient = await Client.findById(id);

    if (!existingClient) {
      return res.status(404).json({
        success: false,
        message: "Client not found ❌",
      });
    }

    let updateData = { ...body };

    delete updateData.biometricData;

    /* =========================
       ✅ PARALLEL: Photo + Documents uploads together
    ========================= */
    const uploadTasks = [];

    // Photo upload task
    let photoUploadIndex = null;
    if (req.files?.photo?.[0]) {
      photoUploadIndex = uploadTasks.length;
      uploadTasks.push(
        uploadToCloudinary(req.files.photo[0].path, "FamousData/photos"),
      );
    }

    // Documents upload tasks
    let docUploadStartIndex = null;
    let documentsMeta = [];
    let normalizedDocumentsMeta = [];
    const uploadedDocuments = req.files?.documents || [];

    if (body.documents) {
      documentsMeta =
        typeof body.documents === "string"
          ? JSON.parse(body.documents)
          : body.documents;
      normalizedDocumentsMeta = Array.isArray(documentsMeta)
        ? documentsMeta
        : [documentsMeta];

      // Collect all file upload promises in order
      const fileUploadMetas = [];
      for (const documentMeta of normalizedDocumentsMeta) {
        const uploadIndex = Number(documentMeta?.uploadIndex);
        const hasUpload =
          Number.isInteger(uploadIndex) &&
          uploadIndex >= 0 &&
          uploadIndex < uploadedDocuments.length;

        if (hasUpload) {
          fileUploadMetas.push({
            documentMeta,
            fileIndex: uploadIndex,
            taskIndex: uploadTasks.length,
          });
          uploadTasks.push(
            uploadToCloudinary(
              uploadedDocuments[uploadIndex].path,
              "FamousData/documents",
            ),
          );
        }
      }

      docUploadStartIndex = fileUploadMetas;
    }

    // ✅ Run all uploads in parallel
    const uploadResults = await Promise.all(uploadTasks);

    // Apply photo result
    if (photoUploadIndex !== null) {
      const previousPhoto = existingClient.photo;
      const newPhotoUrl = uploadResults[photoUploadIndex];
      updateData.photo = newPhotoUrl;
      updateData.photoCapturedAt = new Date();

      if (previousPhoto && previousPhoto !== newPhotoUrl) {
        // delete old photo in background (non-blocking)
        deleteFromCloudinary(previousPhoto).catch(console.error);
      }
    }

    // Apply document results
    if (body.documents) {
      const documentsByType = new Map();

      // Start from existing DB documents
      existingClient.documents?.forEach((doc) => {
        if (doc?.documentType && doc?.imageUrl) {
          documentsByType.set(doc.documentType, {
            documentType: doc.documentType,
            imageUrl: doc.imageUrl,
          });
        }
      });

      // Map uploaded files back using taskIndex
      const uploadedDocMap = new Map();
      if (docUploadStartIndex) {
        for (const { documentMeta, taskIndex } of docUploadStartIndex) {
          uploadedDocMap.set(
            Number(documentMeta?.uploadIndex),
            uploadResults[taskIndex],
          );
        }
      }

      for (const documentMeta of normalizedDocumentsMeta) {
        const documentType = documentMeta?.documentType || "Other";
        const uploadIndex = Number(documentMeta?.uploadIndex);
        const hasUpload =
          Number.isInteger(uploadIndex) &&
          uploadIndex >= 0 &&
          uploadIndex < uploadedDocuments.length;

        if (hasUpload) {
          const docUrl = uploadedDocMap.get(uploadIndex);
          const previousDocument = documentsByType.get(documentType);

          documentsByType.set(documentType, {
            documentType,
            imageUrl: docUrl,
          });

          if (
            previousDocument?.imageUrl &&
            previousDocument.imageUrl !== docUrl
          ) {
            // delete old doc in background
            deleteFromCloudinary(previousDocument.imageUrl).catch(
              console.error,
            );
          }
          continue;
        }

        if (documentMeta?.imageUrl) {
          documentsByType.set(documentType, {
            documentType,
            imageUrl: documentMeta.imageUrl,
          });
        }
      }

      updateData.documents = Array.from(documentsByType.values());
    }

    /* =========================
       UPDATE BIOMETRICS (optional)
    ========================= */
    if (req.files?.biometrics && body.biometricData) {
      const biometricMeta = JSON.parse(body.biometricData);

      const bioPromises = req.files.biometrics.map((bioFile, i) =>
        uploadToCloudinary(bioFile.path, "FamousData/biometrics").then(
          (url) => ({
            fingerType: biometricMeta[i]?.fingerType || "Unknown",
            fingerprintUrl: url,
            quality: biometricMeta[i]?.quality || 0,
          }),
        ),
      );

      updateData.biometricData = await Promise.all(bioPromises);
    }

    updateData.familyMembersCount = Number(body.familyMembersCount) || 0;

    const updatedClient = await Client.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Client updated successfully ✅",
      client: updatedClient,
    });
  } catch (error) {
    console.error("❌ Update Client Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   UPDATE CLIENT STATUS
========================= */
export const updateClientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { registrationStatus, remarks } = req.body;

    if (!registrationStatus) {
      return res.status(400).json({
        success: false,
        message: "registrationStatus is required ❌",
      });
    }

    const client = await Client.findByIdAndUpdate(
      id,
      { registrationStatus, remarks },
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: "Client status updated successfully ✅",
      client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   DELETE CLIENT
========================= */
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found ❌",
      });
    }

    res.status(200).json({
      success: true,
      message: "Client deleted successfully ✅",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   CLIENT STATS
========================= */
export const getClientStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const data = {
      total: await Client.countDocuments(),
      today: await Client.countDocuments({
        createdAt: { $gte: todayStart, $lt: tomorrowStart },
      }),
      pending: await Client.countDocuments({ registrationStatus: "Pending" }),
      completed: await Client.countDocuments({
        registrationStatus: "Completed",
      }),
      rejected: await Client.countDocuments({ registrationStatus: "Rejected" }),
    };

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
