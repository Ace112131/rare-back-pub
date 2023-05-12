const { query } = require("../db/mysql");
const sql = require("sql-template-strings");
const dal = require("../dal");
const s3 = require("../helpers/s3");

const processUploadS3 = async (prefix, file) => {
  const { createReadStream, mimetype, encoding, filename } = await file;

  const { Location } = await s3
    .upload({
      Bucket: "rare-library",
      Key: prefix + filename,
      Body: createReadStream(),
      ContentType: mimetype,
    })
    .promise();
  return new Promise((resolve, reject) => {
    if (Location) {
      resolve({
        success: true,
        message: "Uploaded",
        mimetype,
        filename,
        location: Location,
        encoding,
      });
    } else {
      reject({
        success: false,
        message: "Failed",
      });
    }
  });
};

module.exports = {
  Query: {
    getLibrary: async (parent, args, { user }) => {
      const params = {
        Bucket: "rare-library",
        Prefix: args.prefix,
      };

      var library = [];
      for (;;) {
        var data = await s3.listObjectsV2(params).promise();

        data.Contents.forEach((elem) => {
          library = library.concat({
            key: elem.Key,
            lastModified: elem.LastModified,
            type: elem.Key.slice(-1) === "/" ? "Folder" : "File",
            size: elem.Size,
          });
        });

        if (!data.IsTruncated) {
          break;
        }
        params.Marker = data.NextMarker;
      }

      const prefixMatch = args.prefix === "" ? [] : args.prefix.match(/\//g);

      return library.filter((item) => {
        const match = item.key.match(/\//g);

        if (match === null) return true;
        if (item.type === "Folder") {
          return (
            args.prefix !== item.key && match.length <= prefixMatch.length + 1
          );
        }

        return match.length <= prefixMatch.length;
      });
    },
    // This is depricated
    getLibraryFolders: async (parent, args, { user }) => {
      const { folderId, filters } = args;

      let folders = [];
      if (!folderId) {
        folders = await dal.files.getRootFolders({ userId: user.id });
      } else {
        folders = await dal.files.getFolderFolders({
          userId: user.id,
          folderId,
        });
      }

      return [
        ...folders.map((folder) => {
          return {
            id: folder.id,
            public_id: folder.public_id,
            name: folder.name,
            owner: {
              id: folder.owner_id,
              name: folder.owner_name,
            },
            section: {
              id: folder.va_section_id,
              name: folder.va_section_name,
            },
          };
        }),
      ];
    },
    // This is depricated
    getLibraryDocuments: async (parent, args, { user }) => {
      // console.log(keys);

      const { folderId, filters } = args;
      let documents;

      if (!folderId) {
        documents = [];
      } else {
        documents = await dal.files.getFolderDocuments({
          userId: user.id,
          folderId,
        });
      }

      return [
        ...documents.map((document) => {
          return {
            id: document.id,
            public_id: document.public_id,
            name: document.name,
            path: document.path,
            thumbnail: document.thumbnail_path,
            type: document.file_type,
            size: document.file_size,
            owner: {
              id: document.owner_id,
              name: document.owner_name,
            },
            section: {
              id: document.va_section_id,
              name: document.va_section_name,
            },
          };
        }),
      ];
    },
  },

  Mutation: {
    deleteLibraryItem: async (parent, args, { user }) => {
      const params = {
        Bucket: "rare-library",
        Prefix: args.prefix,
      };

      const listedObjects = await s3.listObjectsV2(params).promise();

      if (listedObjects.Contents.length === 0) return;

      const deleteParams = {
        Bucket: "rare-library",
        Delete: { Objects: [] },
      };

      listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
      });

      await s3.deleteObjects(deleteParams).promise();

      return true;
    },
    createLibraryFolder: async (parent, args, { user }) => {
      const params = {
        Bucket: "rare-library",
        Key: args.prefix,
      };

      await s3.putObject(params).promise();

      return true;
    },
    uploadLibraryFile: async (parent, args, { user }) => {
      (await Promise.all(args.files)).map((file) =>
        processUploadS3(args.prefix, file)
      );

      return true;
    },
  },
};
