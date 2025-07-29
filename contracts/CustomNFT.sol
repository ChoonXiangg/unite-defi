// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @title CustomNFT
 * @dev ERC721 NFT contract with minting, enumeration, URI storage, and royalty support
 */
contract CustomNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable, IERC2981 {
    uint256 private _nextTokenId;
    string private _baseTokenURI;
    
    // Royalty info
    address private _royaltyReceiver;
    uint96 private _royaltyFeeBps; // Basis points (1/100 of a percent)
    
    // Collection metadata
    string public description;
    string public externalLink;
    
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event RoyaltyUpdated(address indexed receiver, uint96 feeBasisPoints);
    
    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        string memory _description,
        address royaltyReceiver,
        uint96 royaltyFeeBps
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _baseTokenURI = baseURI;
        description = _description;
        _royaltyReceiver = royaltyReceiver;
        _royaltyFeeBps = royaltyFeeBps;
        _nextTokenId = 1;
    }
    
    /**
     * @dev Mint a single NFT to specified address
     */
    function mint(address to, string memory uri) public onlyOwner {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit NFTMinted(to, tokenId, uri);
    }
    
    /**
     * @dev Batch mint NFTs to multiple addresses
     */
    function batchMint(
        address[] memory recipients,
        string[] memory tokenURIs
    ) public onlyOwner {
        require(recipients.length == tokenURIs.length, "Arrays length mismatch");
        require(recipients.length <= 50, "Batch size too large");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            mint(recipients[i], tokenURIs[i]);
        }
    }
    
    /**
     * @dev Mint NFT with custom token ID (for specific numbering)
     */
    function mintWithId(address to, uint256 tokenId, string memory uri) public onlyOwner {
        require(_ownerOf(tokenId) == address(0), "Token ID already exists");
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        // Update next token ID if necessary
        if (tokenId >= _nextTokenId) {
            _nextTokenId = tokenId + 1;
        }
        
        emit NFTMinted(to, tokenId, uri);
    }
    
    /**
     * @dev Burn an NFT
     */
    function burn(uint256 tokenId) public {
        require(_isAuthorized(ownerOf(tokenId), msg.sender, tokenId), "Not authorized to burn");
        _burn(tokenId);
    }
    
    /**
     * @dev Set the base URI for all tokens
     */
    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Set collection description
     */
    function setDescription(string memory _description) public onlyOwner {
        description = _description;
    }
    
    /**
     * @dev Set external link for collection
     */
    function setExternalLink(string memory _externalLink) public onlyOwner {
        externalLink = _externalLink;
    }
    
    /**
     * @dev Set royalty information
     */
    function setRoyaltyInfo(address receiver, uint96 feeBasisPoints) public onlyOwner {
        require(feeBasisPoints <= 10000, "Royalty fee too high"); // Max 100%
        _royaltyReceiver = receiver;
        _royaltyFeeBps = feeBasisPoints;
        
        emit RoyaltyUpdated(receiver, feeBasisPoints);
    }
    
    /**
     * @dev Get next token ID that will be minted
     */
    function getNextTokenId() public view returns (uint256) {
        return _nextTokenId;
    }
    
    /**
     * @dev Get all token IDs owned by an address
     */
    function tokensOfOwner(address owner) public view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokens = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            tokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokens;
    }
    
    /**
     * @dev Get collection stats
     */
    function getCollectionInfo() public view returns (
        string memory contractName,
        string memory contractSymbol,
        string memory desc,
        uint256 supply,
        address contractOwner,
        address royaltyReceiver,
        uint96 royaltyFee
    ) {
        return (
            name(),
            symbol(),
            description,
            totalSupply(),
            owner(),
            _royaltyReceiver,
            _royaltyFeeBps
        );
    }
    
    // EIP-2981 Royalty Standard
    function royaltyInfo(uint256, uint256 salePrice) 
        public 
        view 
        override 
        returns (address, uint256) 
    {
        uint256 royaltyAmount = (salePrice * _royaltyFeeBps) / 10000;
        return (_royaltyReceiver, royaltyAmount);
    }
    
    // Override required functions
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }
    
    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}