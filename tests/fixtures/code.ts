export const pythonCode = `
from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

class PhotoModel:
    def __init__(self, id: str, filename: str):
        self.id = id
        self.filename = filename
    
    def to_dict(self):
        return {"id": self.id, "filename": self.filename}

def validate_photo(data):
    if "filename" not in data:
        raise ValueError("Filename required")
    return True

@app.route('/photos', methods=['GET'])
def get_photos():
    return jsonify({"photos": []})

@app.route('/photos', methods=['POST'])
def upload_photo():
    data = request.get_json()
    validate_photo(data)
    return jsonify({"id": "123", "filename": data["filename"]})

@app.route('/photos/<id>', methods=['GET'])
def get_photo(id):
    return jsonify({"id": id, "filename": "test.jpg"})

def helper_function():
    return True
`

export const typescriptCode = `
import express, { Router, Request, Response } from 'express';

interface PhotoProps {
  id: string;
  filename: string;
  url: string;
}

class PhotoController {
  private photos: PhotoProps[] = [];
  
  async getAll(req: Request, res: Response) {
    return res.json(this.photos);
  }
  
  async create(req: Request, res: Response) {
    const photo: PhotoProps = req.body;
    this.photos.push(photo);
    return res.json(photo);
  }
}

const router: Router = express.Router();

router.get('/photos', async (req, res) => {
  const controller = new PhotoController();
  await controller.getAll(req, res);
});

router.post('/photos', async (req, res) => {
  const controller = new PhotoController();
  await controller.create(req, res);
});

router.get('/photos/:id', async (req, res) => {
  const { id } = req.params;
  return res.json({ id });
});

export { router, PhotoController, PhotoProps };
export const config = { debug: true };
`

export const javascriptCode = `
const express = require('express');
const router = express.Router();

class PhotoService {
  constructor() {
    this.photos = [];
  }
  
  getAll() {
    return this.photos;
  }
  
  create(photo) {
    this.photos.push(photo);
    return photo;
  }
}

function validatePhoto(data) {
  if (!data.filename) {
    throw new Error('Filename required');
  }
  return true;
}

router.get('/photos', (req, res) => {
  const service = new PhotoService();
  res.json(service.getAll());
});

router.post('/photos', (req, res) => {
  const service = new PhotoService();
  validatePhoto(req.body);
  res.json(service.create(req.body));
});

router.delete('/photos/:id', (req, res) => {
  res.json({ deleted: req.params.id });
});

module.exports = router;
`

export const goCode = `
package main

import (
    "net/http"
    "encoding/json"
)

type Photo struct {
    ID       string \`json:"id"\`
    Filename string \`json:"filename"\`
}

func getPhotos(w http.ResponseWriter, r *http.Request) {
    photos := []Photo{}
    json.NewEncoder(w).Encode(photos)
}

func createPhoto(w http.ResponseWriter, r *http.Request) {
    var photo Photo
    json.NewDecoder(r.Body).Decode(&photo)
    json.NewEncoder(w).Encode(photo)
}

func main() {
    http.HandleFunc("/photos", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case "GET":
            getPhotos(w, r)
        case "POST":
            createPhoto(w, r)
        }
    })
    http.ListenAndServe(":8080", nil)
}
`

export const mixedCode = `
import express from 'express';
import { PhotoModel } from './models/photo';
import { uploadPhoto, getPhotos } from './controllers/photos';
from 'fs' import readFile

interface PhotoRequest {
    filename: string;
    size: number;
}

// Express router setup
const app = express();

class ImageProcessor {
    private buffer: Buffer;
    
    processImage(data: Buffer): string {
        return data.toString('base64');
    }
}

app.get('/photos', getPhotos);
app.post('/photos', uploadPhoto);
`

export const edgeCases = `
# Edge cases that should NOT be extracted as functions

def returnHelper():
    return helper()  # return statement - not a function def

def awaitHelper():
    return await fetch()  # await in return - not a function

async function main() {
    const result = await Promise.resolve();  # await - not a function
    return result;
}

function processCallback() {
    callback(data);  # callback - not a function definition
    return data;
}

const handler = () => {
    return handle();  # arrow with return - not main function def
};

class Parent {
    method() {
        return this.helper();  # method call - not function def
    }
}
`

export const routePatterns = `
# Various route patterns

# Express-style
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

# Flask-style decorators
@app.route('/photos')
def get_photos():
    pass

# FastAPI-style
@app.get("/items")
async def read_items():
    pass

@app.post("/items")
def create_item(item: Item):
    pass

# NestJS decorators
@Controller('photos')
export class PhotosController {
    @Get()
    findAll() {}
    
    @Post()
    create(@Body() data: any) {}
}
`