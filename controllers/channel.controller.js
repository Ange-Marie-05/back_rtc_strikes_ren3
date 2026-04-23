import * as channelsModel from "../models/channels.models.js";
import prisma from '../config/prisma.js';
import {createError} from '../utils/errors.js';

async function getChannels(req,res,next) {
    try {
        const channels = await prisma.channel.findMany();
        res.status(200).json(channels);
    } catch (error) {
        error.type = 'CHANNEL_FETCH_ERROR';
        next(error);
    }
}

async function getChannelInfoById(req,res,next) {
    try {
        const { id: channelId } = req.params;
    
        const channel = await channelsModel.findChannelById(channelId);
    
        if (!channel) {
            throw createError("CHANNEL_NOT_FOUND");
        }
    
        res.status(200).json(channel);
    
    } catch (error) {
        if (!error.type) error.type = "DATABASE_ERROR";
        next(error);
    }
}

async function getChannelsByServer(req,res,next) {
    try {
        const channels = await prisma.channel.findMany({
            where: {serverId: req.params.id}
        });
        res.status(200).json(channels);
    } catch (error) {
        error.type = 'CHANNEL_FETCH_ERROR';
        next(error);
    }
}

async function createChannel(req,res,next) {
    try {
        const serverId = req.params.id;
        const name = req.body.name?.trim();
        // Validation
        if (!name) {
            throw createError('CHANNEL_INPUT_EMPTY');
        }
        // Création channel
        const channel = await prisma.channel.create({
            data: {
                name: name,
                serverId: serverId
            }
        });
        res.status(201).json({
            success: true,
            message: 'Channel créé avec succès !',
            data: {
                name: channel.name,
                serverId: channel.serverId
            }
        });
    } catch (error) {
        if (error.code === 'P2002') {
            error.type = "CHANNEL_ALREADY_EXISTS";
        } else if (!error.type) {
            error.type = "DATABASE_ERROR";
        }
        next(error);
    }
}

export async function deleteChannelById(req, res, next) {
    try {
        const userId = req.session.user?.id;
        const { id: channelId } = req.params;

        if (!userId) {
            throw createError("USER_NOT_AUTHENTICATED");
        }

        await channelsModel.deleteChannelByIdDB(userId, channelId);

        res.status(200).json({
            success: true,
            message: "Le channel a été supprimé avec succès."
        });

    } catch (error) {
        if (!error.type) {
            error.type = "DATABASE_ERROR";
        }
        next(error);
    }
}
// route put 

export async function updateChannelById(req, res, next) {
    try {
        const userId = req.session.user?.id;
        const { id: channelId } = req.params;
        const { name } = req.body;

        if (!userId) throw createError("USER_NOT_AUTHENTICATED");

        if (!name || name.trim() === "") {
            throw createError("CHANNEL_INPUT_EMPTY");
        }

        const updatedChannel = await channelsModel.updateChannelbyIdDB(userId, channelId, name);

        res.status(200).json({
            success: true,
            message: "Channel mis à jour avec succès",
            channel: updatedChannel,
        });
    } catch (error) {
        if (!error.type) error.type = "DATABASE_ERROR";
        next(error);
    }
}




export default { 
    getChannels,
    getChannelInfoById, 
    getChannelsByServer,
    createChannel,
    deleteChannelById,
    updateChannelById
};