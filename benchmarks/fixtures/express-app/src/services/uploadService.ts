export class UploadService {
  private files: Map<string, any> = new Map()

  async uploadPhoto(filename: string, data: string): Promise<any> {
    const id = `file_${Date.now()}`
    const file = { id, filename, data, type: "photo", createdAt: new Date() }
    this.files.set(id, file)
    return file
  }

  async uploadAvatar(filename: string, data: string): Promise<any> {
    const id = `file_${Date.now()}`
    const file = { id, filename, data, type: "avatar", createdAt: new Date() }
    this.files.set(id, file)
    return file
  }

  async getFile(id: string): Promise<any> {
    return this.files.get(id)
  }

  async deleteFile(id: string): Promise<void> {
    this.files.delete(id)
  }
}