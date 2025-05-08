'use client'

import { useState, useEffect } from 'react'
import { formatEther, parseEther, formatUnits, getAddress } from 'viem'
import { useChainId, useConfig, useSwitchChain,useWriteContract,useAccount, useConnect, useDisconnect, useSendTransaction, useSignMessage, useEnsName } from 'wagmi'
import { createCoinCall,getCoinCreateFromLogs,getCoinsTopGainers,getProfileBalances,getCoin,getCoinComments,simulateBuy,tradeCoinCall } from "@zoralabs/coins-sdk";
import { getPublicClient } from 'wagmi/actions'
import { Toaster, toast } from 'sonner'
import { Copy } from 'lucide-react'
import type { Address } from 'viem';
import React from 'react';
import { getTransactionReceipt } from '@wagmi/core';
function App() {
  const account = useAccount()
  const { connectors, connect, status, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: ensName } = useEnsName({ address: account.address });
  const { sendTransaction, error: sendTransactionError, isPending: isSendingTransaction, data: transactionData } = useSendTransaction();
  const [coinName, setCoinName] = useState('')
  const [currentTheme, setCurrentTheme] = useState('cupcake')
  const [balanceAddressInput, setBalanceAddressInput] = useState<`0x${string}` | ''>('');
  const [displayedBalance, setDisplayedBalance] = useState<string | null>(null);
  const [zoraCoinBalances, setZoraCoinBalances] = useState<any[]>([]);
  const [zoraCoinNextPage, setZoraCoinNextPage] = useState<string | null>(null);
  const [isLoadingZoraBalances, setIsLoadingZoraBalances] = useState<boolean>(false);
  const [coinImageUrl, setCoinImageUrl] = useState<string>('');
  const [coinDescription, setCoinDescription] = useState<string>('');
  const [coinSymbol, setCoinSymbol] = useState<string>('');
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [txHashes, setTxHashes] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<boolean>(false);
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [transactionInput, setTransactionInput] = useState<`0x${string}` | ''>('');
  const [coinCheckMessage, setCoinCheckMessage] = useState<string | null>(null);
  const chainId = useChainId()
  const config = useConfig()
  const chain = config.chains.find((c) => c.id === chainId)
  const publicClient = getPublicClient(config, { chainId })
  const { writeContractAsync } = useWriteContract(); 
  const { address, isConnected } = account;

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [toAddress, setToAddress] = React.useState("");
  const [buyModalCoinAddress, setBuyModalCoinAddress] = useState<Address | null>(null);
  const [buyModalCoinSymbol, setBuyModalCoinSymbol] = useState<string | null>(null);
  const [buyModalCoinName, setBuyModalCoinName] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState<string>("");
  const [isTrading, setIsTrading] = useState<boolean>(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setAmount("");
    setToAddress("");
  };

  const handleSendTransaction = async () => {
    if (!toAddress || !amount) {
      toast.error("Please enter both address and amount.");
      return;
    }
    if (!getAddress(toAddress)) {
      toast.error("Invalid recipient address.");
      return;
    }
    try {
      const value = parseEther(amount);
      sendTransaction({
        to: toAddress as `0x${string}`,
        value: value,
      });
    } catch (e: any) {
      toast.error(`Error preparing transaction: ${e.message}`);
    }
  };

  useEffect(() => {
    if (transactionData) {
      toast.success(`Transaction sent! Hash: ${transactionData}`);
      closeModal();
    }
  }, [transactionData]);

  useEffect(() => {
    if (sendTransactionError) {
      const message = (sendTransactionError as any)?.shortMessage || sendTransactionError.message;
      toast.error(`Transaction failed: ${message}`);
    }
  }, [sendTransactionError]);

  async function getBalance(address: `0x${string}`) {
    if (!publicClient) return null;
    const balance = await publicClient.getBalance({ address })
    return formatEther(balance)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme)
  }, [currentTheme])

  const toggleTheme = () => {
    const newTheme = currentTheme === 'cupcake' ? 'night' : 'cupcake'
    setCurrentTheme(newTheme)
  }

  const handleCreateCoin = async () => {
    const payload = {
      collection: 'metadata',
      data: {
        name: coinName,
        symbol: coinSymbol,
        description: coinDescription,
        payoutAddress: address as Address,
        platformAddress: address as Address,
      },
    };
    try {
      const res = await fetch('/api/create-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const created = await res.json();
      if (!res.ok || !created.success) {
        toast.error(created.error || 'Failed to create metadata');
        throw new Error('Failed to create metadata');
      }

      // Save the image using the metadata ID as the name
      const imageUrl = coinImageUrl;
      if (imageUrl.startsWith('data:image')) {
        try {
          const matches = imageUrl.match(/^data:(image\/\w+);base64,(.*)$/);
          const base64Data = matches ? matches[2] : '';
          if (base64Data) {
            const saveImageRes = await fetch('/api/save-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: created.result.$loki, base64: base64Data }),
            });
            if (!saveImageRes.ok) {
              const saveErr = await saveImageRes.json();
              toast.error(`Failed to save image: ${saveErr.error || 'Unknown error'}`);
              // Decide if you want to throw error here or just warn
              console.error('Failed to save image:', saveErr);
            }
          }
        } catch (imgSaveError) {
          toast.error('Error saving image');
          console.error('Error saving image:', imgSaveError);
        }
      }

      // console.log(created)
      const coinParams = {
            name: coinName,
            symbol: coinSymbol,
            uri: `${process.env.NEXT_PUBLIC_DOMAIN}/api/metadata/${created.result.$loki}`,
            payoutRecipient: address as Address,
            platformReferrer: address as Address,
          };
          const { chain, ...restOfContractCallParams } = await createCoinCall(coinParams);
                                 
          
          const tx = await writeContractAsync({
            ...restOfContractCallParams,
     
          });
          const res2 = await fetch('/api/create-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collection: 'create_coins_transactions',
              data: {
                txHash: tx,
                address,
                chainId,
                metadataId: created.result.$loki,
                date: new Date().toISOString(),
              },
            }),
          });
          const res3 = await fetch('/api/create-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collection: 'transactions',
              data: {
                txHash: tx,
                address,
                chainId,
                date: new Date().toISOString(),
              },
            }),
          });
          if(!res2.ok || !res3.ok){
            toast.error('Network error saving create coin transaction');
          
          }
          setTxHashes(tx);
          setCreateSuccess(true);
  } catch(e) {
    console.error(e);
    toast.error('Network error saving coin');
  } finally {
    setCreateLoading(false);
  }
  }

  const handleCheckBalance = async () => {
    const targetAddress = balanceAddressInput || address;
    if (targetAddress) {
      // ETH Balance Check
      const balance = await getBalance(targetAddress as `0x${string}`);
      setDisplayedBalance(balance);

      // Zora Coin Balance Check
      setIsLoadingZoraBalances(true);
      setZoraCoinBalances([]); // Reset previous balances
      setZoraCoinNextPage(null);
      try {
        const { balanceData, nextPage } = await getZoraCoinBalance(targetAddress as `0x${string}`, '');
        setZoraCoinBalances(balanceData);
        setZoraCoinNextPage(nextPage);
      } catch (e) {
        console.error("Failed to fetch Zora coin balances:", e);
        toast.error("Failed to fetch Zora coin balances.");
      } finally {
        setIsLoadingZoraBalances(false);
      }
    }
  };

async function getZoraCoinBalance(addressParam: `0x${string}`,nextPageCursor: string) {
  const response = await getProfileBalances({
    identifier: addressParam, 
    count: 20,        
    after: nextPageCursor, 
    chainIds: [chainId]
  });
 
  const profile: any = response.data?.profile;
  const pageInfo = profile.coinBalances?.pageInfo;
  
  let balanceData: any[] = [];
  balanceData=response.data?.profile?.coinBalances?.edges.map((edge: any) => edge.node) || [];
  return {balanceData,nextPage:pageInfo?.endCursor}
}

const handleLoadMoreZoraBalances = async () => {
  const targetAddress = balanceAddressInput || address;
  if (targetAddress && zoraCoinNextPage) {
    setIsLoadingZoraBalances(true);
    try {
      const { balanceData, nextPage } = await getZoraCoinBalance(targetAddress as `0x${string}`, zoraCoinNextPage);
      setZoraCoinBalances(prevBalances => [...prevBalances, ...balanceData]);
      setZoraCoinNextPage(nextPage);
    } catch (e) {
      console.error("Failed to fetch more Zora coin balances:", e);
      toast.error("Failed to fetch more Zora coin balances.");
    } finally {
      setIsLoadingZoraBalances(false);
    }
  }
};

  const handleGenerateImage = async () => {
    if (!coinDescription.trim()) {
      toast.error("Please enter a coin description to generate an image.");
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100000); // 100 seconds timeout

    setIsGeneratingImage(true);
    try {
      toast.loading("Generating image...");
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: coinDescription }),
        signal: controller.signal, // Added abort signal
      });
      clearTimeout(timeoutId); // Clear timeout if fetch completes
      toast.dismiss();
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.images && data.images.length > 0) {
        // Assuming the API returns images prefixed with data URI scheme
        // If not, we might need to add "data:image/png;base64,"
        let imageUrl = data.images[0];
        if (!imageUrl.startsWith('data:')) {
          imageUrl = `data:image/png;base64,${imageUrl}`;
        }
        setCoinImageUrl(imageUrl);
        toast.success("Image generated and URL set!");
      } else {
        toast.error("No images returned from API.");
      }
    } catch (error: any) {
      clearTimeout(timeoutId); // Clear timeout if fetch errors
      toast.dismiss();
      console.error("Failed to generate image:", error);
      if (error.name === 'AbortError') {
        toast.error("Image generation timed out after 100 seconds.");
      } else {
        toast.error(`Failed to generate image: ${error.message}`);
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <>
      <Toaster />
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Smart Wallet Demo</h1>
          <button onClick={toggleTheme} className="btn btn-ghost">
            {currentTheme === 'cupcake' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title">Connect</h2>
            {connectors
              .filter((connector) => connector.name === 'Coinbase Wallet')
              .map((connector) => (
                <div key={connector.uid} className="flex flex-col space-y-2">
                  {account.isConnected && account.connector?.id === connector.id ? (
                    <button
                      type="button"
                      onClick={() => disconnect({ connector })}
                      className="btn btn-secondary"
                    >
                      Disconnect smart wallet
                    </button>
                  ) : (
                    <button
                      onClick={() => connect({ connector })}
                      type="button"
                      className="btn btn-primary"
                      disabled={status === 'pending'}
                    >
                      Sign in with Smart Wallet
                    </button>
                  )}
                </div>
              ))}
            {status && <div className="mt-2">Status: <span className="font-semibold">{status}</span></div>}
            {connectError?.message && <div className="text-error mt-2">Error: {connectError.message}</div>}
          </div>
        </div>

        {isConnected && address && (
          <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
              <h2 className="card-title">Connected Wallet Address</h2>
              <div className="flex items-center">
                <div className="flex items-center space-x-2">
                  <p className="text-lg font-mono break-all">{address}</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(address);
                      toast.success("Address copied to clipboard");
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
  {/* New Address Card */}
  {isConnected && address && (
          <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
              <h2 className="card-title">Balance</h2>
              <div className="form-control w-full max-w-xs mb-4">
              
                <input 
                  type="text" 
                  placeholder="Add address"
                  className="input input-bordered w-full"
                  value={balanceAddressInput}
                  onChange={(e) => setBalanceAddressInput(e.target.value as `0x${string}` | '')}
                />
              </div>
              <button 
                type="button" 
                onClick={handleCheckBalance}
                className="btn btn-primary mb-2"
              >
                Check Balance
              </button>
              <div className="flex items-center">
                <p className="text-lg font-mono break-all">
                  {displayedBalance !== null ? (
                    <>
                      {displayedBalance} ETH
                      <button 
                        onClick={openModal}
                        className="btn btn-secondary btn-sm ml-2"
                      >
                        Transfer
                      </button>
                    </>
                  ) : 'Enter an address or if empty will show connected wallet balance'}
                </p>
              </div>
              { /* Zora Coin Balances Display */ }
              <div className="w-full overflow-x-auto mt-4" style={{ maxWidth: '100%' }}>
                <h3 className="text-xl font-semibold mb-2">Zora Coin Balances</h3>
                <div className="grid grid-cols-4 gap-2 text-sm items-center bg-muted p-2 rounded-t-md">
                  <div className="text-center font-medium">Name (Symbol)</div>
                  <div className="text-center font-medium">Balance</div>
                  <div className="text-center font-medium">Token Address</div>
                  <div className="text-center font-medium">Action</div>
                </div>
                {isLoadingZoraBalances && zoraCoinBalances.length === 0 && <div className="text-center py-2">Loading Zora coin balances...</div>}
                {zoraCoinBalances.length > 0 ? (
                  zoraCoinBalances.map((bal:any, i:number)=>(
                    <div key={i} className="grid grid-cols-4 gap-2 text-sm items-center border-b border-muted py-1">
                      <div className="text-center py-2 truncate">{bal.coin.name} ({bal.coin.symbol})</div>
                      <div className="text-center py-2">{parseFloat(formatUnits(BigInt(bal.balance), bal.coin.decimals)).toFixed(4)} {bal.coin.symbol}</div>
                      <div className="text-center py-2 flex items-center justify-center">
                        <span className="truncate font-mono text-xs mr-1">{bal.coin.address}</span>
                        <button className="h-6 w-6 p-0 ml-1" onClick={()=>{navigator.clipboard.writeText(bal.coin.address);toast.success('Address copied');}}>
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="text-center py-2 flex items-center justify-center">
                        <button 
                          className="btn btn-xs btn-primary mr-1" 
                          onClick={() => {
                            setBuyModalCoinAddress(bal.coin.address);
                            setBuyModalCoinName(bal.coin.name);
                            setBuyModalCoinSymbol(bal.coin.symbol);
                            setBuyAmount(""); // Reset buy amount when opening modal
                            const modal = document.getElementById(`buy-modal-${i}`) as HTMLDialogElement | null;
                            if (modal) {
                              modal.showModal();
                            }
                          }}
                        >
                          Buy
                        </button>
                      
                        
                        {/* Buy Modal */}
                        <dialog id={`buy-modal-${i}`} className="modal">
                          <div className="modal-box">
                            <h3 className="font-bold text-lg">Buy {buyModalCoinName || bal.coin.name}</h3>
                            <p className="py-2">Coin Address: <span className="font-mono text-xs">{buyModalCoinAddress || bal.coin.address}</span></p>
                            <p className="py-4">Enter the amount of ETH you want to use to buy {buyModalCoinSymbol || bal.coin.symbol}.</p>
                            <div className="form-control w-full">
                              <label className="label">
                                <span className="label-text">Amount (ETH)</span>
                              </label>
                              <input 
                                type="number" 
                                placeholder="Amount in ETH" 
                                className="input input-bordered w-full"
                                value={buyAmount}
                                onChange={(e) => setBuyAmount(e.target.value)}
                                disabled={isTrading}
                              />
                            </div>
                            <div className="modal-action">
                              <button 
                                className="btn btn-primary mr-2"
                                disabled={isTrading || !buyAmount || parseFloat(buyAmount) <= 0}
                                onClick={async () => {
                                  if (!buyModalCoinAddress || !address) {
                                    toast.error("Required information missing.");
                                    return;
                                  }
                                  setIsTrading(true);
                                  toast.loading("Processing buy order...");
                                  try {
                                    const parsedAmount = parseEther(buyAmount);
                                    if (parsedAmount <= BigInt(0)) {
                                      toast.error("Amount must be greater than 0.");
                                      setIsTrading(false);
                                      toast.dismiss();
                                      return;
                                    }

                                    const tradeParams = {
                                      direction: 'buy' as 'buy' | 'sell',
                                      target: buyModalCoinAddress,
                                      args: {
                                        recipient: address,
                                        orderSize: parsedAmount, 
                                        minAmountOut: BigInt(0), 
                                      }
                                    };
                                    const { chain, ...restOfTradeContractCallParams } = await tradeCoinCall(tradeParams);
                                    
                                    const tx = await writeContractAsync({
                                      ...restOfTradeContractCallParams,
                                      // Consider adding a gas limit if needed, e.g., gas: 230000n 
                                    });
                                    toast.dismiss();
                                    toast.success(`Buy order submitted! TX: ${tx}`);
                                    // Optionally, close modal and refresh balances
                                    const modal = document.getElementById(`buy-modal-${i}`) as HTMLDialogElement | null;
                                    if (modal) modal.close();
                                    setBuyAmount("");
                                    // Consider calling handleCheckBalance() or a more specific refresh function
                                  } catch (e: any) {
                                    console.error("Buy transaction failed:", e);
                                    toast.dismiss();
                                    const message = e?.shortMessage || e.message || "Transaction failed";
                                    toast.error(`Buy failed: ${message}`);
                                  } finally {
                                    setIsTrading(false);
                                  }
                                }}
                              >
                                {isTrading ? <span className="loading loading-spinner loading-xs"></span> : "Buy"}
                              </button>
                              <button 
                                className="btn" 
                                onClick={() => {
                                  const modal = document.getElementById(`buy-modal-${i}`) as HTMLDialogElement | null;
                                  if (modal) modal.close();
                                  setBuyAmount(""); // Reset amount when closing
                                }}
                                disabled={isTrading}
                              >
                                Close
                              </button>
                            </div>
                          </div>
                          <form method="dialog" className="modal-backdrop">
                            <button onClick={() => {
                              const modal = document.getElementById(`buy-modal-${i}`) as HTMLDialogElement | null;
                              if (modal) modal.close();
                              setBuyAmount(""); // Reset amount when closing via backdrop
                            }}>close</button>
                          </form>
                        </dialog>
                        
                        {/* Sell Modal */}
                        <dialog id={`sell-modal-${i}`} className="modal">
                          <div className="modal-box">
                            <h3 className="font-bold text-lg">Sell {bal.coin.name}</h3>
                            <p className="py-4">Enter the amount of {bal.coin.symbol} you want to sell.</p>
                            <div className="form-control w-full">
                              <input 
                                type="number" 
                                placeholder="Amount" 
                                className="input input-bordered w-full" 
                                max={parseFloat(formatUnits(BigInt(bal.balance), bal.coin.decimals))}
                              />
                            </div>
                            <div className="modal-action">
                              <form method="dialog">
                                <button className="btn btn-secondary mr-2">Sell</button>
                                <button className="btn">Close</button>
                              </form>
                            </div>
                          </div>
                        </dialog>
                      </div>
                    </div>
                  ))
                ) : !isLoadingZoraBalances && <div className="text-center py-2">No Zora coin balances found for this address.</div>}
                {zoraCoinNextPage && !isLoadingZoraBalances && (
                  <button
                    type="button"
                    onClick={handleLoadMoreZoraBalances}
                    className="btn btn-secondary mt-2 w-full"
                  >
                    Load More Zora Balances
                  </button>
                )}
                {isLoadingZoraBalances && zoraCoinBalances.length > 0 && <div className="text-center py-2">Loading more...</div>}
              </div>
            </div>
          </div>
        )}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title">Create Zora Coin</h2>
            
            <div className="form-control w-full max-w-xs mb-4">
              <label className="label">
                <span className="label-text">Image URL</span>
              </label>
              <div className="flex items-center w-full max-w-xs">
                <input
                  type="text"
                  placeholder="Enter image URL"
                  className="input input-bordered w-full"
                  value={coinImageUrl}
                  onChange={(e) => setCoinImageUrl(e.target.value)}
                />
                <button 
                  className="btn btn-ghost btn-outline ml-2"
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                >
                  {isGeneratingImage ? <span className="loading loading-spinner loading-xs"></span> : '✨'}
                </button>
              </div>
              {coinImageUrl && (
                <div className="mt-2">
                  <p className="text-sm mb-1">Preview:</p>
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-base-300">
                    <img 
                      src={coinImageUrl} 
                      alt="Coin preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://placehold.co/100x100?text=Invalid+URL";
                        toast.error("Failed to load image");
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="form-control w-full max-w-xs">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input 
                type="text" 
                placeholder="Enter coin name"
                className="input input-bordered w-full max-w-xs"
                value={coinName}
                onChange={(e) => setCoinName(e.target.value)}
              />
            </div>
            <div className="form-control w-full max-w-xs">
              <label className="label">
                <span className="label-text">Symbol</span>
              </label>
              <input 
                type="text" 
                placeholder="Enter symbol"
                className="input input-bordered w-full max-w-xs"
                value={coinSymbol}
                onChange={(e) => setCoinSymbol(e.target.value)}
              />
            </div>
            <div className="form-control w-full max-w-xs">
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <input 
                type="text" 
                placeholder="Enter description"
                className="input input-bordered w-full max-w-xs"
                value={coinDescription}
                onChange={(e) => setCoinDescription(e.target.value)}
              />
            </div>
           
          
            <button 
              type="button" 
              onClick={handleCreateCoin}
              className="btn btn-primary mt-4"
              disabled={createLoading}
            >
              {createLoading ? <span className="loading loading-spinner loading-xs"></span> : 'Create'}
            </button>
            {createSuccess && txHashes && (
              <div className="mt-4 p-2 border border-success rounded-md bg-success/10">
                <p className="text-sm text-success-content text-white">Transaction successful!</p>
                <p className="text-xs text-success-content/80 break-all text-white">
                  Hash: <a 
                            href={`https://sepolia.basescan.org/tx/${txHashes}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="link link-hover text-white"
                          >
                            {txHashes}
                          </a>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(txHashes);
                      toast.success("Hash copied to clipboard!");
                    }}
                    className="btn btn-xs btn-ghost ml-1"
                  >
                    <Copy size={14} />
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
        {isConnected && address && (
          <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
              <h2 className="card-title">Check coin address via their transaction receipt</h2>
              <div className="flex items-center">
                <div className="form-control w-full">
                  <input 
                    type="text" 
                    placeholder="Input transaction receipt here"
                    className="input input-bordered w-full"
                    value={transactionInput}
                    onChange={(e) => setTransactionInput(e.target.value as `0x${string}` | '')}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary mt-2"
                    onClick={async () => {
                      if (!transactionInput) {
                        toast.error("Please input a transaction receipt.");
                        return;
                      }
                      try {
                        const receipt = await getTransactionReceipt(config, { hash: transactionInput });
                        const coinDeployment = getCoinCreateFromLogs(receipt);
                        const coinAddress = coinDeployment?.coin;
                        const msg = `Transaction: ${transactionInput}\nCoin Address: ${coinAddress || 'Not found'}`;
                        setCoinCheckMessage(msg);
                        if (coinAddress) {
                          toast.success("Coin address found!");
                        } else {
                          toast("Coin address not found in this transaction.");
                        }
                      } catch (err: any) {
                        console.error("Error checking transaction:", err);
                        toast.error(`Error checking transaction: ${err.message || 'Unknown error'}`);
                        setCoinCheckMessage(null);
                      }
                    }}
                  >
                    Check
                  </button>
                  {coinCheckMessage && (
                    <div className="mt-2 p-2 border border-info rounded-md bg-info/10">
                      <p className="text-sm text-info-content whitespace-pre-wrap">{coinCheckMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      
      </div>

      {isModalOpen && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box relative">
            <button 
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
              onClick={closeModal}
              disabled={isSendingTransaction}
            >
              ✕
            </button>
            <h3 className="font-bold text-lg">Send ETH</h3>
            <div className="py-4">
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text">Recipient Address</span>
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="input input-bordered w-full"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  disabled={isSendingTransaction}
                />
              </div>
              <div className="form-control w-full mt-4">
                <label className="label">
                  <span className="label-text">Amount (ETH)</span>
                </label>
                <input
                  type="text"
                  placeholder="0.01"
                  className="input input-bordered w-full"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isSendingTransaction}
                />
              </div>
            </div>
            <div className="modal-action">
              <button 
                className="btn btn-primary" 
                onClick={handleSendTransaction}
                disabled={isSendingTransaction || !toAddress || !amount}
              >
                {isSendingTransaction ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Sending...
                  </>
                ) : "Send"}
              </button>
              <button 
                className="btn" 
                onClick={closeModal} 
                disabled={isSendingTransaction}
              >
                Cancel
              </button>
            </div>
          </div>
          {/* Click outside to close */}
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeModal} disabled={isSendingTransaction}>close</button>
          </form>
        </div>
      )}
    </>
  )
}

export default App
