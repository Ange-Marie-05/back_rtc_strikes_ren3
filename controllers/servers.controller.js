import * as serversModel from "../models/servers.models.js";
import { createError } from "../utils/errors";
import { getIO } from "../socket.js";

// controller pour route GET
export async function getServerInfoById(req, res, next) {
    try {
        const { id: serverId } = req.params;

        const server = await serversModel.findServerById(serverId);

        if (!server) {
            throw createError("SERVER_NOT_FOUND");
        }

        res.status(200).json(server);

    } catch (error) {
        if (!error.type) error.type = "DATABASE_ERROR";
        next(error);
    }
}

export async function getMembersServerById(req, res, next) {
  try {
    const { id: serverId } = req.params;

    const members = await serversModel.findMembersByServerId(serverId);

    if (!members) {
      throw createError("SERVER_NOT_FOUND");
    }

    // Transformer la réponse pour simplifier côté front
    const formattedMembers = members.map((m) => ({
      id: m.user.id,
      username: m.user.username,
      role: m.role,
      joinedAt: m.joinedAt,
      banned: m.banned
    }));

    console.log(formattedMembers)

    res.status(200).json(formattedMembers);
  } catch (error) {
    if (!error.type) error.type = "DATABASE_ERROR";
    next(error);
  }
}

async function getRoleOnServerById(req, res, next) {
    try {
        const userId = req.session.user?.id;
        const { id: serverId } = req.params;

        if (!userId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }

        const role = await serversModel.getMyRole(serverId, userId);
        

        res.status(200).json({
            role,
        });
    } catch (error) {
        if (!error.type) {
            error.type = "DATABASE_ERROR";
        }
        next(error);
    }
}

// Controller pour route POST

export async function createServer(req, res, next) {
    try {
        const { name } = req.body;
        const ownerId = req.session.user?.id;

        if (!ownerId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }

        if (!name || name.trim() === "") {
            throw createError("SERVER_NAME_EMPTY");
        }

        const newServer = await serversModel.createServerDB(name, ownerId);

        res.status(201).json(newServer);
    } catch (error) {
        // name déjà existant
        if (error.code === 'P2002') {
          return next(createError('SERVER_EXISTS_ALREADY'));
        }

        if (!error.type) {
            error.type = "DATABASE_ERROR";
        }
        next(error);
    }
}



export async function joinServerById(req, res, next) {
    try {
        const userId = req.session.user?.id;
        const { id: serverId } = req.params;

        if (!userId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }

        const membership = await serversModel.joinServer(userId, serverId);

        res.status(200).json({
            success: true,
            message: `Vous avez rejoint le serveur "${membership.server.name}"`,
            server: membership.server
        });
    } catch (error) {
        if (!error.type) {
            error.type = "DATABASE_ERROR";
        }
        next(error);
    }
}

// route delete
export async function deleteServerById(req, res, next) {
    try {
        const userId = req.session.user?.id;
        const { id: serverId } = req.params;

        if (!userId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }

        // Appelle la fonction métier pour supprimer le serveur
        await serversModel.deleteServer(userId, serverId);

        res.status(200).json({
            success: true,
            message: "Le serveur a été supprimé avec succès."
        });

    } catch (error) {
        if (!error.type) {
            error.type = "DATABASE_ERROR";
        }
        next(error);
    }
}

export async function leaveServerById(req, res, next) {
    try {
        const userId = req.session.user?.id;
        const { id: serverId } = req.params;

        if (!userId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }

        const membership = await serversModel.leaveServer(userId, serverId);

        res.status(200).json({
            success: true,
            message: `Vous avez quitté le serveur "${membership.server.name}"`,
            server: membership.server
        });
    } catch (error) {
        if (!error.type) {
            error.type = "DATABASE_ERROR";
        }
        next(error);
    }
}

// route PUT


export async function updateServerById(req, res, next) {
    try {
        const userId = req.session.user?.id;
        const { id: serverId } = req.params;
        const { name } = req.body;

        if (!userId) throw createError("USER_NOT_AUTHENTICATED");

        if (!name || name.trim() === "") {
            throw createError("SERVER_NAME_EMPTY");
        }

        const updatedServer = await serversModel.updateServer(userId, serverId, name);

        res.status(200).json({
            success: true,
            message: "Serveur mis à jour avec succès",
            server: updatedServer,
        });
    } catch (error) {
        if (!error.type) error.type = "DATABASE_ERROR";
        next(error);
    }
}

export async function updateMemberServerById(req, res, next) {
    try {
        const userId = req.session.user?.id;
        const { id: serverId, userId: memberId } = req.params;
        const { role } = req.body;

        if (!userId) throw createError("USER_NOT_AUTHENTICATED");

        if (!role || !["Owner", "Admin", "Member"].includes(role)) {
            throw createError("INVALID_ROLE");
        }

        const updatedMember = await serversModel.updateMemberRole(userId, serverId, memberId, role);

        const server = await serversModel.findServerById(serverId);

        if (!server) {
            throw createError("SERVER_NOT_FOUND");
        }

        const io = getIO();
        if (io) {
            io.emit(`server:${serverId}:member_role_changed`, {
              userId: memberId,
              role: updatedMember.role,
              action: "role",
              messageFr: `Votre rôle sur le serveur "${server.name}" a été mis à jour : vous êtes maintenant ${updatedMember.role === "Owner" ? "Propriétaire" : updatedMember.role === "Admin" ? "Administrateur" : "Membre"}.`,
              messageEn: `Your role on the server "${server.name}" has been updated: you are now ${updatedMember.role === "Owner" ? "Owner" : updatedMember.role === "Admin" ? "Admin" : "Member"}.`,
            });
        }

        res.status(200).json({
            success: true,
            message: `Le rôle du membre a été mis à jour avec succès`,
            member: updatedMember,
        });
    } catch (error) {
        if (!error.type) error.type = "DATABASE_ERROR";
        next(error);
    }
}

export async function kickMemberById(req, res, next) {
    try {
        const requesterId = req.session.user?.id;
        const { id: serverId, userId: memberId } = req.params;

        if (!requesterId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }
        
        await serversModel.kickMember(requesterId, memberId, serverId);
        const server = await serversModel.findServerById(serverId);

        if (!server) {
            throw createError("SERVER_NOT_FOUND");
        }

        const io = getIO();
        if (io) {
            io.emit(`server:${serverId}:user_must_leave`, { 
                userId: memberId,
                action: "kick",
                messageFr: `Vous avez été expulsé du serveur "${server.name}"`,
                messageEn: `You have been kicked from the server "${server.name}"`,
            });

            io.emit(`server:${serverId}:member_removed`, {
              userId: memberId,
              action: "kick",
            });
        }

        res.status(200).json({
            success: true,
            message: "Le membre a été expulsé avec succès"
        });

    } catch (error) {
        if (!error.type) error.type = "DATABASE_ERROR";
        next(error);
    }
}

export async function banMemberPermanently(req, res, next) {
    try {
        const requesterId = req.session.user?.id;
        const { id: serverId, userId: memberId } = req.params;

        if (!requesterId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }

        const data = await serversModel.banMemberPerm(requesterId, serverId, memberId);
        const server = await serversModel.findServerById(serverId);

        if (!server) {
            throw createError("SERVER_NOT_FOUND");
        }

        const io = getIO();
        if (io) {
            io.emit(`server:${serverId}:user_must_leave`, { 
                userId: memberId,
                action: "permBan",
                messageFr: `Vous avez été banni définitivement du serveur "${server.name}"`,
                messageEn: `You have been permanently banned from the server "${server.name}"`,
            });

            io.emit(`server:${serverId}:member_removed`, {
              userId: memberId,
              action: "permBan",
            });
        }

        res.status(200).json({
            success: true,
            message: `${data.username} a été ban permanement`,
            username: data.username
        });
    } catch (error) {
        if (!error.type) error.type = "DATABASE_ERROR";
        next(error);
    }
}

export async function unbanMember(req, res, next) {
    try {
        const requesterId = req.session.user?.id;
        const { id: serverId, userId: memberId } = req.params;

        if (!requesterId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }

        const data = await serversModel.unbanMemberPerm(requesterId, serverId, memberId);

        const members = await serversModel.findMembersByServerId(serverId);

        const formattedMembers = members.map((m) => ({
          id: m.user.id,
          username: m.user.username,
          role: m.role,
          joinedAt: m.joinedAt,
          banned: m.banned,
        }));

        const io = getIO();
        if (io) {
            io.emit(`server:${serverId}:member_unbanned`, {
                members: formattedMembers.filter((member) => member.banned === false),
            });
        }

        res.status(200).json({
            success: true,
            message: `${data.username} a été unban`,
            username: data.username
        });
    } catch (error) {
        if (!error.type) error.type = "DATABASE_ERROR";
        next(error);
    }
}

async function getAvailableServers(req, res, next) {
    try {
        const userId = req.session.user?.id;
        //console.log("userId:", req.session.user.id);

        if (!userId) {
            throw createError('USER_NOT_AUTHENTICATED');
        }

        const servers = await serversModel.findAvailableServersByUser(userId);

        res.status(200).json({
            success: true,
            servers: servers
        });
    } catch (error) {
        if (!error.type) {
            error.type = "DATABASE_ERROR";
        }
        next(error);
    }
}

async function isBanned(req,res,next){
    try {
        const { id: id, userId: userId } = req.params;
        res.status(200).json({
            banned : await serversModel.isBannedModel(userId,id)
        })
    } catch (error) {
        if (!error.type) {
            error.type = "DATABASE_ERROR";
        }
        next(error);
    }
}

export async function banMemberTemporarily(req, res, next) {
    try {
        const requesterId = req.session.user?.id;
        const { id: serverId, userId: memberId } = req.params;
        const { durationDays } = req.body;

        if (!requesterId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }

        if (!durationDays || durationDays <= 0) {
            throw createError("INVALID_BAN_DURATION");
        }

        const result = await serversModel.banMemberTemp(requesterId, memberId, serverId, durationDays);
        const server = await serversModel.findServerById(serverId);

        if (!server) {
            throw createError("SERVER_NOT_FOUND");
        }

        const banEndDateFr = result.banEndDate.toLocaleDateString("fr-FR");
        const banEndDateEn = result.banEndDate.toLocaleDateString("en-GB");

        const io = getIO();
        if (io) {
            io.emit(`server:${serverId}:user_must_leave`, { 
                userId: memberId,
                action: "tempBan",
                messageFr: `Vous avez été banni temporairement du serveur "${server.name}" jusqu'au ${banEndDateFr}`,
                messageEn: `You have been temporarily banned from the server "${server.name}" until ${banEndDateEn}`,
            });

            io.emit(`server:${serverId}:member_removed`, {
              userId: memberId,
              action: "tempBan",
            });
        }

        res.status(200).json({
            success: true,
            message: `Le membre a été banni temporairement jusqu'au ${result.banEndDate.toLocaleDateString()}`,
            banEndDate: result.banEndDate
        });

    } catch (error) {
        if (!error.type) error.type = "DATABASE_ERROR";
        next(error);
    }
}

export default { 
    getServerInfoById, 
    getMembersServerById, 
    createServer, 
    joinServerById, 
    deleteServerById, 
    leaveServerById, 
    updateServerById, 
    updateMemberServerById, 
    getRoleOnServerById, 
    kickMemberById, 
    banMemberPermanently, 
    unbanMember, 
    getAvailableServers, 
    isBanned, 
    banMemberTemporarily};
