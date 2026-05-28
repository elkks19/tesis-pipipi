para internacinalizacion y localizacion 
leer sobre i18n


<!-- NOTE: Evaluar si vale la pena incluirlo en el documento -->
MINIMAMENTE PARA LOS TESTS
EN CADA SPRINT
    - pruebas unitarias
    - pruebas de integracion
    - pruebas de sistema
    - prueba de satisfaccion

Los valores de prueba deberian ser
* Edge cases
    - Maximo
    - Minimo

* Valores dentro del rango (validos)
    - numeros, etc
    - Objetos validos

* Valores invalidos (objetos invalidos)

* Tipos de datos diferentes (lenguajes no fuertemente tipados)


TABLA PARA ANOTAR LOS TESTS

PROPIEDAD               |       SIGNIFICADO
------------------------|-----------------------------
Identificador           |   Codigo unico de la prueba
                        |
Valores de entrada      |   Descripcion de los datos de entrada de un objeto de prueba
                        |
Resultados esperados    |   Datos de salida que se espera se produzcan
                        |
Precondiciones          |   Situacion previa a la ejecucion de la prueba o caracteristicas
                        |   de un objeto de prueba antes de ejecutar un caso de prueba
                        |
Postcondiciones         |   Caracteristicas de un objeto de prueba tras la ejecucion de la prueba
                        |
Dependencias            |   Relacion u orden de dependencia entre casos de prueba
                        |
Acciones                |   Pasos a llevar a cabo para ejecutar la prueba
                        |
Requisito vinculado     |   Relacion de requisitos que se pretendian validar con la ejecucion de la prueba
                        |


Las pruebas de integracion tienen que ser incrementales

