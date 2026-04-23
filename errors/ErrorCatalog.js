const ErrorCatalog = {
    // Database errors
    DATABASE_ERROR: {
        code: 500,
        message: 'Échec de la connexion au serveur / Failed to connect to the server'
    },


    // Users errors
    USER_NOT_FOUND: {
        code: 404,
        message: 'Utilisateur introuvable / User cannot be found'
    },

    USER_NOT_AUTHENTICATED: {
        code: 401,
        message: 'Utilisateur non authentifié / User not authenticated'
    },

    USER_FETCH_ERROR: {
        code: 500,
        message: 'Échec de la récupération des utilisateurs / Failed to fetch users'
    },

    USER_INVALID_DATA: {
        code: 401,
        message: 'Données invalides / Invalid data'
    },

    USER_INPUT_EMPTY: {
        code: 400,
        message: 'Champ(s) vide(s) / Empty field(s)'
    },

    USER_NOT_AUTHORIZED: {
        code: 403,
        message: "Vous n'êtes pas autorisé à réaliser cette action / You are not authorized to perform this action"
    },

    USER_USERNAME_INCORRECT: {
        code: 400,
        message: "Nom d'utilisateur: au moins 3 caractères / Username: at least 3 characters"
    },

    USER_EMAIL_INCORRECT: {
        code: 400,
        message: "Email: format xxxx@gmail.com / Email: format xxxx@gmail.com"
    },

    USER_PASSWORD_INCORRECT: {
        code: 400,
        message: 'Mot de passe: au moins 8 caractères (2 chiffres, 2 Majuscules, 2 minuscules, 2 spéciaux) / Password: at least 8 characters (2 digits, 2 uppercase, 2 lowercase, 2 special characters)'
    },

    USER_INVALID_CODE_TOTP: {
        code: 401,
        message: 'Code incorrect / Incorrect code'
    },

    USER_EXISTS_ALREADY: {
        code: 409,
        message: "Cet utilisateur existe déjà / This user already exists"
    },

    USER_INVALID_TOKEN: {
        code: 400,
        message: "Lien de modification du mot de passe invalide ou déjà utilisé / Invalid or already used password change link"
    },

    USER_TOKEN_EXPIRED: {
        code: 400,
        message: "Lien de modification du mot de passe expiré / Expired password change link"
    },

    USER_USERNAME_ALREADY_USED: {
        code: 409,
        message: "Ce nom d'utilisateur est déjà utilisé / This username is already taken"
    },

    USER_NOT_MEMBER: {
        code: 400,
        message: "Vous n'êtes pas membre de ce serveur / You are not a member of this server"
    },

    OWNER_CANNOT_LEAVE: {
        code: 403,
        message: "Vous êtes owner du serveur, cédez le rôle avant de quitter / You are the server owner, transfer ownership before leaving"
    },


    // Channels
    CHANNEL_FETCH_ERROR: {
        code: 500,
        message: 'Échec de la récupération des channels / Failed to fetch channels'
    },

    CHANNEL_ALREADY_EXISTS: {
        code: 409,
        message: 'Nom de channel déjà existant / Channel name already exists'
    },

    CHANNEL_INPUT_EMPTY: {
        code: 400,
        message: 'Nom de channel vide / Channel name is empty'
    },

    CHANNEL_NOT_FOUND: {
        code: 404,
        message: "Channel introuvable / Channel cannot be found"
    },


    // Message Errors
    MESSAGE_CONTENT_EMPTY: {
        code: 400,
        message: 'Contenu du message vide / Message content is empty'
    },

    MESSAGE_INVALID_CONTENT: {
        code: 400,
        message: 'Contenu du message trop long / Message content is too long'
    },

    MESSAGE_NOT_FOUND: {
        code: 404,
        message: "Message introuvable / Message cannot be found"
    },

    MESSAGE_UNAUTHORIZED_DELETE: {
        code: 403,
        message: "Vous n'êtes pas autorisé à supprimer ce message / You are not authorized to delete this message"
    },

    MESSAGE_UNAUTHORIZED_EDIT: {
        code: 403,
        message: "Vous n'êtes pas autorisé à éditer ce message / You are not authorized to edit this message"
    },


    // Server
    SERVER_NOT_FOUND: {
        code: 404,
        message: 'Serveur introuvable / Server cannot be found'
    },

    SERVER_NAME_EMPTY: {
        code: 400,
        message: 'Le champ du serveur ne doit pas être vide / Server name must not be empty'
    },

    SERVER_ALREADY_JOINED: {
        code: 409,
        message: 'Vous êtes déjà membre de ce serveur / You are already a member of this server'
    },

    SERVER_GOT_BANNED: {
        code: 409,
        message: 'Vous avez été banni définitivement / You have been permanently banned'
    },

    NOT_SERVER_OWNER: {
        code: 403,
        message: "Seul le propriétaire du serveur peut modifier les informations / Only the server owner can modify information"
    },
    
    INVALID_ROLE: {
        code: 400,
        message: "Le rôle spécifié est invalide / The specified role is invalid"
    },


    // Member
    MEMBER_NOT_FOUND: {
        code: 404,
        message: "Membre non trouvé dans ce serveur / Member not found in this server"
    },

    MEMBER_CANNOT_BE_KICK: {
        code: 403,
        message: "Vous n'êtes pas autorisé à expulser ce membre / You are not authorized to kick this member"
    },

    //Ban
    INVALID_BAN_DURATION: {
    code: 400,
    message: "La durée du ban doit être supérieure à 0 / Ban duration must be greater than 0"
    },

    // React
    REACT_NOT_FOUND: {
        code: 404,
        message: "Réaction non trouvée / Reaction not found"
    },
};

export { ErrorCatalog };