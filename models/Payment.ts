import {DataTypes, Model, Optional} from "sequelize";
import sequelize from "@/lib/sequelize";

// 1. Define attribute interfaces
export interface PaymentAttributes {
    id: number;
    txnid: string;
    amount: number;
    customer_id: number;
    firstname?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: "pending" | "completed" | "failed" | "cancelled" | "refunded" | null;
    request?: string | null;
    response?: string | null;
    error_msg?: string | null;
    created_at: Date;
    updated_at?: Date;
}

export interface PaymentCreationAttributes extends Optional<PaymentAttributes, "id" | "created_at" | "updated_at"> {}

// 2. Define Payment class
class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
    public id!: number;
    public txnid!: string;
    public amount!: number;
    public customer_id!: number;
    public firstname!: string | null;
    public email!: string | null;
    public phone!: string | null;
    public status!: PaymentAttributes["status"];
    public request!: string | null;
    public response!: string | null;
    public error_msg!: string | null;
    public created_at!: Date;
    public updated_at!: Date;
}

// 3. Initialize Payment model
export const initPaymentModel = (): typeof Payment => {
    Payment.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                comment: "Primary key for payments table",
            },
            txnid: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                validate: {
                    notEmpty: true,
                    len: [1, 50],
                },
                comment: "Unique transaction ID",
            },
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                validate: {
                    isDecimal: true,
                    min: 0.01,
                },
                comment: "Transaction amount",
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    isInt: true,
                    min: 1,
                },
                comment: "Customer ID reference",
            },
            firstname: {
                type: DataTypes.STRING(100),
                allowNull: true,
                validate: {
                    len: [0, 100],
                },
                comment: "Customer first name",
            },
            email: {
                type: DataTypes.STRING(100),
                allowNull: true,
                validate: {
                    isEmail: {
                        msg: "Must be a valid email address",
                    },
                    len: [0, 100],
                },
                comment: "Customer email address",
            },
            phone: {
                type: DataTypes.STRING(20),
                allowNull: true,
                validate: {
                    len: [0, 20],
                    is: {
                        args: /^[+]?[\d]{7,20}$/,
                        msg: "Phone number must be valid",
                    },
                },
                comment: "Customer phone number",
            },
            status: {
                type: DataTypes.ENUM("pending", "completed", "failed", "cancelled", "refunded"),
                allowNull: true,
                defaultValue: "pending",
                comment: "Payment status",
            },
            request: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Payment gateway request payload",
            },
            response: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Payment gateway response payload",
            },
            error_msg: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Error message if payment failed",
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                comment: "Record creation timestamp",
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "Record update timestamp",
            },
        },
        {sequelize, tableName: "payments", timestamps: true}
    );

    return Payment;
};

export default Payment;
