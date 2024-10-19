import { Serializable } from "./serializable";
import { Contact } from "./contact";
import { createRobohashIcon, GravatarIcon } from "../common/icons";

export type AvatarType = "gravatar" | "robohash";

export interface ProfilePictureDBEntry {
    type: AvatarType;
    gravatarHash: string;
}

export class ProfilePicture implements Serializable {
    private type: AvatarType = "robohash";
    private contact: Contact;
    private gravatarIcon: GravatarIcon = new GravatarIcon;

    public constructor(contact: Contact) {
        this.contact = contact;
    }

    async getIconSource(size: number) {
        if(this.type == "gravatar") {
            return this.gravatarIcon.createURL({
                size, defaultType: "identicon", rating: "R"
            });
        } else if(this.type == "robohash") {
            return createRobohashIcon(this.contact.id, 4);
        }

        return "";
    }
    getInitials() {
        throw new Error("Method not implemented.");
    }

    public async setGravatar(email: string) {
        this.type = "gravatar";
        await this.gravatarIcon.setFromEmail(email);
    }

    async serialize(): Promise<ProfilePictureDBEntry> {
        return {
            type: this.type,
            gravatarHash: this.gravatarIcon.hash
        };
    }
    async deserialize(data: ProfilePictureDBEntry) {
        this.type = data.type;
        this.gravatarIcon = new GravatarIcon(data.gravatarHash);
    }
}