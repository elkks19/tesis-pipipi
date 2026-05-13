from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# modelo
model = SentenceTransformer("all-MiniLM-L6-v2")

# documentos
docs = [
    "Cómo cambiar mi contraseña",
    "Métodos de pago disponibles",
    "Tiempo estimado de envío"
]

# embeddings de documentos
doc_embeddings = model.encode(docs)

print(doc_embeddings.shape)



# pregunta del usuario
query = "No puedo entrar, cómo cambio mi clave?"

# embedding de la pregunta
query_embedding = model.encode([query])

# comparar similitud
similarities = cosine_similarity(query_embedding, doc_embeddings)

print(similarities)


import numpy as np

best_match = np.argmax(similarities)

print(docs[best_match])
