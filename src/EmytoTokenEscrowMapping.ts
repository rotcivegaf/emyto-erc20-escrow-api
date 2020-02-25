import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  CreateEscrow,
  SignedCreateEscrow,
  CancelSignature,
  Deposit,
  Withdraw,
  Cancel,
  SetEmytoFee,
  EmytoWithdraw,
  OwnershipTransferred
} from "../generated/EmytoTokenEscrow/EmytoTokenEscrow"
import { Escrow, EscrowHistory, EmytoBalance, Emyto, CanceledSignatures } from "../generated/schema"

let BI0 = BigInt.fromI32(0);

export function handleCreateEscrow(event: CreateEscrow): void {
  let escrow = new Escrow(event.params._escrowId.toHex());

  escrow.escrowId = event.params._escrowId;
  escrow.agent = event.params._agent;
  escrow.depositant = event.params._depositant;
  escrow.retreader = event.params._retreader;
  escrow.fee = event.params._fee;
  escrow.token = event.params._token;
  escrow.salt = event.params._salt;

  escrow.balance = BI0;
  escrow.emytoFeeCharged = BI0;
  escrow.agentFeeCharged = BI0;
  escrow.agentSignature = null;
  escrow.state = "Created";

  saveEscrowHistory(escrow, event.block.timestamp, "Create");

  escrow.save()
}

export function handleSignedCreateEscrow(event: SignedCreateEscrow): void {
  let escrow = Escrow.load(event.params._escrowId.toHex());

  escrow.agentSignature = event.params._agentSignature;

  escrow.save()
}

export function handleCancelSignature(event: CancelSignature): void {
  if (CanceledSignatures.load(event.params._agentSignature.toHex()) == null) {
    let canceledSignatures = new CanceledSignatures(event.params._agentSignature.toHex());

    canceledSignatures.signature = event.params._agentSignature;

    canceledSignatures.save();
  }
}

export function handleDeposit(event: Deposit): void {
  if (event.params._toEscrow.isZero())
    return;

  let escrow = Escrow.load(event.params._escrowId.toHex());

  escrow.state = "ToWithdraw";
  escrow.balance = escrow.balance.plus(event.params._toEscrow);

  if (event.params._toEmyto.notEqual(BI0)) {
    escrow.emytoFeeCharged = escrow.emytoFeeCharged.plus(event.params._toEmyto);

    let emytoBalance = EmytoBalance.load(escrow.token.toHex());

    if (emytoBalance === null) {
      emytoBalance = new EmytoBalance(escrow.token.toHex());

      emytoBalance.token = escrow.token;
      emytoBalance.balance = BI0;
    }

    emytoBalance.balance = emytoBalance.balance.plus(event.params._toEmyto);

    emytoBalance.save()
  }

  saveEscrowHistory(escrow, event.block.timestamp, "Deposit");

  escrow.save()
}

export function handleWithdraw(event: Withdraw): void {
  if (event.params._toAmount.isZero())
    return;

  let escrow = Escrow.load(event.params._escrowId.toHex());

  escrow.balance = escrow.balance.minus(event.params._toAgent.plus(event.params._toAmount));
  escrow.agentFeeCharged = escrow.agentFeeCharged.plus(event.params._toAgent);

  if (escrow.balance.isZero())
    escrow.state = "WithdrawnAll";

  saveEscrowHistory(escrow, event.block.timestamp, "Withdraw");

  escrow.save()
}

export function handleCancel(event: Cancel): void {
  let escrow = Escrow.load(event.params._escrowId.toHex());

  escrow.state = "Cancel";
  escrow.balance = escrow.balance.minus(event.params._amount);

  saveEscrowHistory(escrow, event.block.timestamp, "Cancel");

  escrow.save()
}

export function handleSetEmytoFee(event: SetEmytoFee): void {
  let emyto = Emyto.load(event.transaction.from.toHex());

  emyto.fee = event.params._fee;

  emyto.save()
}

export function handleEmytoWithdraw(event: EmytoWithdraw): void {
  if (event.params._amount.isZero())
    return;

  let emytoBalance = EmytoBalance.load(event.params._token.toHex());

  emytoBalance.balance = emytoBalance.balance.minus(event.params._amount);

  emytoBalance.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  let oldEmyto = Emyto.load(event.params._previousOwner.toHex());
  let emyto = Emyto.load(event.params._newOwner.toHex());

  if (emyto === null) {
    emyto = new Emyto(event.params._newOwner.toHex());
    emyto.owner = event.params._newOwner;
  } else {
    emyto.owner = event.params._newOwner;
  }

  if (oldEmyto === null) {
    emyto.fee = BI0;
  } else {
    emyto.fee = oldEmyto.fee;
  }

  emyto.save()
}

function makeId(escrowId: Bytes, time: BigInt): string {
  return escrowId.toHex() + "_" + time.toString();
}

function saveEscrowHistory(escrow: Escrow | null, time: BigInt, eventName: string): void {
  let escrowHistory = new EscrowHistory(makeId(escrow.escrowId, time));

  escrowHistory.escrowId = escrow.escrowId;
  escrowHistory.balance = escrow.balance;
  escrowHistory.emytoFeeCharged = escrow.emytoFeeCharged;
  escrowHistory.agentFeeCharged = escrow.agentFeeCharged;
  escrowHistory.state = escrow.state;
  escrowHistory.eventName = eventName;
  escrowHistory.timestamp = time;

  escrowHistory.save()
}