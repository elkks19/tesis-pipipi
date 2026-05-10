export type PacienteSearchResult = {
  id: string;
  datosPersonales: {
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    fechaNacimiento: string;
    documentoIdentidad: string;
    numeroDocumentoIdentidad: string;
  };
  genero: string;
  lugarNacimiento: {
    pais: string;
    departamento: string;
    distrito?: string;
  };
  nacionalidad: string;
  etnia?: string;
  padres?: {
    datosPersonales: {
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
      fechaNacimiento: string;
      documentoIdentidad: string;
      numeroDocumentoIdentidad: string;
    };
    relacion: string;
    asumeSustento: boolean;
    numeroContacto: string;
  }[];
};
